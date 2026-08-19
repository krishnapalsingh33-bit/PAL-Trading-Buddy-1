import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests


logger = logging.getLogger(__name__)


class MacroNewsProvider:
    """Broad GBP/USD macro-news collector with resilient GDELT access.

    GDELT is treated as one evidence source, not the entire intelligence layer.
    The provider deliberately caches successful results and backs off on 429s so
    frontend polling cannot hammer the public endpoint.
    """

    BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

    CACHE_SECONDS = 15 * 60
    REQUEST_TIMEOUT = 20
    MAX_RECORDS = 50
    TIMESpan = "72h"

    QUERY = (
        "("
        '"Federal Reserve" OR FOMC OR "Fed minutes" OR "Fed chair" OR '
        '"Bank of England" OR BoE OR MPC OR "BoE minutes" OR '
        '"US inflation" OR "US CPI" OR "US PCE" OR "US PPI" OR '
        '"UK inflation" OR "UK CPI" OR "UK PPI" OR '
        '"nonfarm payrolls" OR NFP OR unemployment OR "jobless claims" OR '
        '"UK jobs" OR "UK employment" OR wages OR payrolls OR '
        'GDP OR PMI OR "retail sales" OR "consumer confidence" OR '
        '"interest rate" OR "rate decision" OR "rate cut" OR "rate hike" OR '
        '"rate expectations" OR "rate hike bets" OR "rate cut bets" OR '
        '"Treasury yields" OR "US yields" OR "gilt yields" OR "UK yields" OR '
        '"yield differential" OR "rate differential" OR DXY OR dollar OR '
        'pound OR sterling OR GBP/USD OR GBPUSD OR '
        'oil OR crude OR "risk aversion" OR "risk appetite" OR geopolitics OR '
        'tariff OR sanctions OR fiscal OR budget'
        ")"
        " AND "
        "("
        '"United States" OR US OR USD OR dollar OR Fed OR '
        '"United Kingdom" OR UK OR GBP OR pound OR sterling OR BoE OR '
        '"GBP/USD" OR GBPUSD'
        ")"
    )

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.3 (macro intelligence; contact: local-app)",
                "Accept": "application/json",
            }
        )
        self._cached_articles: list[dict[str, Any]] = []
        self._last_successful_fetch = 0.0

    def _request(self) -> dict[str, Any]:
        params = {
            "query": self.QUERY,
            "mode": "artlist",
            "format": "json",
            "maxrecords": self.MAX_RECORDS,
            "timespan": self.TIMESpan,
            "sort": "datedesc",
        }

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self.session.get(
                    self.BASE_URL,
                    params=params,
                    timeout=self.REQUEST_TIMEOUT,
                )
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    delay = float(retry_after) if retry_after and retry_after.isdigit() else (2 ** attempt) * 2
                    logger.warning("GDELT rate limited; backing off %.1fs", delay)
                    time.sleep(min(delay, 8.0))
                    last_error = RuntimeError("GDELT rate limited (HTTP 429).")
                    continue

                response.raise_for_status()
                if not response.text.strip():
                    raise RuntimeError("GDELT returned an empty response.")

                content_type = response.headers.get("content-type", "").lower()
                try:
                    payload = response.json()
                except ValueError as ex:
                    snippet = response.text[:120].replace("\n", " ")
                    raise RuntimeError(
                        f"GDELT returned invalid JSON ({content_type or 'unknown content type'}: {snippet})."
                    ) from ex

                if not isinstance(payload, dict):
                    raise RuntimeError("GDELT returned an unexpected response.")
                return payload
            except Exception as ex:
                last_error = ex
                if attempt < 2:
                    time.sleep((2 ** attempt) * 1.5)

        raise last_error or RuntimeError("GDELT request failed.")

    @staticmethod
    def _parse_datetime(value):
        if not value:
            return None
        value = str(value).strip()
        formats = (
            "%Y%m%dT%H%M%SZ",
            "%Y%m%d%H%M%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
        )
        for fmt in formats:
            try:
                parsed = datetime.strptime(value, fmt)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)
            except ValueError:
                continue
        return None

    @staticmethod
    def _detect_currency(title: str, domain: str) -> str:
        text = f"{title} {domain}".lower()
        gbp_terms = ("bank of england", "boe", "united kingdom", "uk ", "britain", "british", "pound", "sterling", "gbp")
        usd_terms = ("federal reserve", "fomc", "fed ", "united states", "us ", "american", "dollar", "usd")
        gbp_score = sum(1 for term in gbp_terms if term in text)
        usd_score = sum(1 for term in usd_terms if term in text)
        if gbp_score > usd_score:
            return "GBP"
        if usd_score > gbp_score:
            return "USD"
        return "CROSS"

    @staticmethod
    def _detect_impact(title: str) -> str:
        title_lower = title.lower()
        high_terms = (
            "federal reserve", "fomc", "fed minutes", "interest rate", "rate decision",
            "bank of england", "boe", "cpi", "inflation", "pce", "nonfarm payroll",
            "nfp", "unemployment", "gdp", "tariff", "sanctions", "geopolit", "oil",
        )
        medium_terms = (
            "retail sales", "jobless claims", "pmi", "employment", "wages",
            "consumer confidence", "consumer sentiment", "manufacturing", "services",
            "treasury yields", "gilt yields", "rate expectations", "risk aversion",
        )
        if any(term in title_lower for term in high_terms):
            return "HIGH"
        if any(term in title_lower for term in medium_terms):
            return "MEDIUM"
        return "LOW"

    def _normalize_article(self, article: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(article, dict):
            return None
        title = str(article.get("title", "")).strip()
        if not title:
            return None
        published = self._parse_datetime(article.get("seendate") or article.get("published") or article.get("date"))
        if published is None:
            return None
        url = str(article.get("url", "")).strip()
        domain = str(article.get("domain", "")).strip()
        return {
            "id": url or title.lower(),
            "title": title,
            "currency": self._detect_currency(title, domain),
            "impact": self._detect_impact(title),
            "published_at": published.isoformat(),
            "published": published.isoformat(),
            "source": domain,
            "url": url,
            "language": str(article.get("language", "")).strip(),
            "provider": "GDELT",
        }

    @staticmethod
    def _deduplicate(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen = set()
        result = []
        for article in articles:
            key = article.get("url") or str(article.get("title", "")).lower()
            if not key or key in seen:
                continue
            seen.add(key)
            result.append(article)
        return result

    def _cache_is_fresh(self) -> bool:
        return bool(self._cached_articles) and (
            time.monotonic() - self._last_successful_fetch < self.CACHE_SECONDS
        )

    def get_news(self, timespan: str = "72h") -> list[dict[str, Any]]:
        if self._cache_is_fresh():
            return list(self._cached_articles)

        try:
            payload = self._request()
            raw_articles = payload.get("articles", [])
            if not isinstance(raw_articles, list):
                raise RuntimeError("GDELT returned no article list.")

            articles = [
                normalized
                for raw_article in raw_articles
                if (normalized := self._normalize_article(raw_article)) is not None
            ]
            articles = self._deduplicate(articles)
            articles.sort(key=lambda article: article.get("published_at", ""), reverse=True)
            articles = articles[: self.MAX_RECORDS]

            self._cached_articles = articles
            self._last_successful_fetch = time.monotonic()
            logger.info("GDELT macro news refreshed: %s articles", len(articles))
            return list(articles)
        except Exception as ex:
            logger.warning("GDELT news refresh failed: %s", ex)
            if self._cached_articles:
                logger.info("Using cached GDELT news: %s articles", len(self._cached_articles))
                return list(self._cached_articles)
            return []
