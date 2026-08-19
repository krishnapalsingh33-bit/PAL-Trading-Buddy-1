import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any

import requests


logger = logging.getLogger(__name__)


class MacroNewsProvider:
    """Retrieve and normalize recent GDELT macro news for GBP/USD.

    GDELT is rate-limited. This provider therefore uses a process-wide cache
    plus a circuit breaker so frontend polling can never turn into a request
    storm. A temporary GDELT outage/rate limit is treated as a source outage,
    not as market evidence.
    """

    BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

    CACHE_SECONDS = 15 * 60
    REQUEST_TIMEOUT = 15
    MAX_RECORDS = 25

    # After a 429 or malformed response, do not immediately retry. This is
    # deliberately longer than the dashboard polling interval.
    RATE_LIMIT_COOLDOWN_SECONDS = 15 * 60
    ERROR_COOLDOWN_SECONDS = 5 * 60

    QUERY = (
        '("Federal Reserve" OR FOMC OR "Bank of England" OR BoE OR '
        '"US inflation" OR "UK inflation" OR CPI OR PCE OR PPI OR '
        '"nonfarm payrolls" OR NFP OR unemployment OR "jobless claims" OR '
        'GDP OR "retail sales" OR PMI OR employment OR wages OR '
        '"interest rate" OR "rate decision") '
        'AND ("United States" OR US OR "United Kingdom" OR UK OR '
        'USD OR GBP OR dollar OR pound OR sterling)'
    )

    # Shared across instances so a dev reload or route reconstruction does
    # not immediately start another GDELT request.
    _cache: list[dict[str, Any]] = []
    _last_successful_fetch = 0.0
    _blocked_until = 0.0
    _last_failure_log = 0.0
    _lock = threading.Lock()

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.0 (+macro-news-provider)",
                "Accept": "application/json",
            }
        )

    @classmethod
    def _cache_is_fresh(cls) -> bool:
        return bool(cls._cache) and (
            time.monotonic() - cls._last_successful_fetch < cls.CACHE_SECONDS
        )

    @classmethod
    def _blocked(cls) -> bool:
        return time.monotonic() < cls._blocked_until

    @classmethod
    def _set_cooldown(cls, seconds: int) -> None:
        cls._blocked_until = max(
            cls._blocked_until,
            time.monotonic() + seconds,
        )

    @classmethod
    def _log_failure_once(cls, message: str) -> None:
        now = time.monotonic()
        if now - cls._last_failure_log >= 60:
            logger.warning(message)
            cls._last_failure_log = now

    def _request(self) -> dict[str, Any]:
        params = {
            "query": self.QUERY,
            "mode": "artlist",
            "format": "json",
            "maxrecords": self.MAX_RECORDS,
            "timespan": "24h",
            "sort": "datedesc",
        }

        response = self.session.get(
            self.BASE_URL,
            params=params,
            timeout=self.REQUEST_TIMEOUT,
        )

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            try:
                retry_seconds = int(retry_after) if retry_after else 0
            except (TypeError, ValueError):
                retry_seconds = 0

            # Never trust an unrealistically small Retry-After for our app.
            cooldown = max(
                self.RATE_LIMIT_COOLDOWN_SECONDS,
                retry_seconds,
            )
            self._set_cooldown(cooldown)
            raise RuntimeError(
                f"GDELT rate limited (429); retry suppressed for {cooldown}s."
            )

        response.raise_for_status()

        if not response.text.strip():
            self._set_cooldown(self.ERROR_COOLDOWN_SECONDS)
            raise RuntimeError("GDELT returned an empty response.")

        try:
            payload = response.json()
        except ValueError as ex:
            self._set_cooldown(self.ERROR_COOLDOWN_SECONDS)
            raise RuntimeError("GDELT returned invalid JSON.") from ex

        if not isinstance(payload, dict):
            self._set_cooldown(self.ERROR_COOLDOWN_SECONDS)
            raise RuntimeError("GDELT returned an unexpected response.")

        return payload

    @staticmethod
    def _parse_datetime(value: Any):
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
        gbp_terms = (
            "bank of england", "boe", "united kingdom", "uk ",
            "britain", "british", "pound", "sterling", "gbp",
        )
        usd_terms = (
            "federal reserve", "fomc", "fed ", "united states", "us ",
            "american", "dollar", "usd",
        )
        gbp_score = sum(term in text for term in gbp_terms)
        usd_score = sum(term in text for term in usd_terms)
        if gbp_score > usd_score:
            return "GBP"
        if usd_score > gbp_score:
            return "USD"
        return "USD/GBP"

    @staticmethod
    def _detect_impact(title: str) -> str:
        title_lower = title.lower()
        high_terms = (
            "federal reserve", "fomc", "interest rate", "rate decision",
            "bank of england", "boe", "cpi", "inflation", "pce", "nonfarm payroll",
            "nfp", "unemployment", "gdp",
        )
        medium_terms = (
            "retail sales", "jobless claims", "pmi", "employment", "wages",
            "consumer confidence", "consumer sentiment", "manufacturing", "services",
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

        published = self._parse_datetime(
            article.get("seendate") or article.get("published") or article.get("date")
        )
        if published is None:
            return None

        url = str(article.get("url", "")).strip()
        domain = str(article.get("domain", "")).strip()
        language = str(article.get("language", "")).strip()

        return {
            "id": url or title,
            "title": title,
            "currency": self._detect_currency(title, domain),
            "impact": self._detect_impact(title),
            "published": published.isoformat(),
            "source": domain,
            "url": url,
            "language": language,
        }

    @staticmethod
    def _deduplicate(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        result: list[dict[str, Any]] = []
        for article in articles:
            key = str(article.get("url") or article.get("title", "")).lower()
            if not key or key in seen:
                continue
            seen.add(key)
            result.append(article)
        return result

    def get_news(self, timespan: str = "24h") -> list[dict[str, Any]]:
        # Fast path: normal dashboard polling is served entirely from cache.
        with self._lock:
            if self._cache_is_fresh():
                return list(self._cache)

            # Critical fix: once GDELT rate-limits us, do not hammer it again
            # every 5 seconds. PALService will use its Google News fallback.
            if self._blocked():
                return list(self._cache)

        try:
            payload = self._request()
            raw_articles = payload.get("articles", [])
            if not isinstance(raw_articles, list):
                self._set_cooldown(self.ERROR_COOLDOWN_SECONDS)
                raise RuntimeError("GDELT returned no article list.")

            articles = [
                normalized
                for raw in raw_articles
                if (normalized := self._normalize_article(raw)) is not None
            ]
            articles = self._deduplicate(articles)
            articles.sort(key=lambda item: item.get("published", ""), reverse=True)
            articles = articles[:15]

            with self._lock:
                self._cache = articles
                self._last_successful_fetch = time.monotonic()
                self._blocked_until = 0.0

            logger.info("GDELT macro news refreshed: %s articles", len(articles))
            return list(articles)

        except Exception as ex:
            # Keep the last good GDELT data. If there is none, return [] so
            # PALService can immediately use Google News instead.
            self._log_failure_once(f"GDELT news refresh failed: {ex}")
            with self._lock:
                return list(self._cache)
