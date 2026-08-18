import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests


logger = logging.getLogger(__name__)


class MacroNewsProvider:
    """
    PAL Macro News Provider.

    Uses the free GDELT DOC API to retrieve recent
    macroeconomic news relevant to GBP/USD.

    IMPORTANT:

    This provider does NOT:
    - analyze charts
    - create trade setups
    - determine entries
    - determine exits
    - provide trading strategy

    It only retrieves and normalizes macro news.

    The provider uses an in-memory cache so that the
    frontend can poll PAL frequently without repeatedly
    calling GDELT.
    """

    BASE_URL = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
    )

    # ----------------------------------------------------------
    # Cache configuration
    # ----------------------------------------------------------

    CACHE_SECONDS = 15 * 60

    REQUEST_TIMEOUT = 20

    MAX_RECORDS = 25

    TIMESpan = "24h"

    # ----------------------------------------------------------
    # Combined GBP/USD macro query
    # ----------------------------------------------------------
    #
    # One request instead of separate USD / GBP / CROSS
    # requests.
    #

    QUERY = (
        "("
        '"Federal Reserve" OR '
        "FOMC OR "
        '"Bank of England" OR '
        "BoE OR "
        '"US inflation" OR '
        '"UK inflation" OR '
        "CPI OR "
        "PCE OR "
        "PPI OR "
        '"nonfarm payrolls" OR '
        "NFP OR "
        "unemployment OR "
        '"jobless claims" OR '
        "GDP OR "
        '"retail sales" OR '
        "PMI OR "
        "employment OR "
        "wages OR "
        '"interest rate" OR '
        '"rate decision"'
        ")"
        " AND "
        "("
        '"United States" OR '
        "US OR "
        '"United Kingdom" OR '
        "UK OR "
        "USD OR "
        "GBP OR "
        "dollar OR "
        "pound OR "
        "sterling"
        ")"
    )

    def __init__(self):

        self.session = requests.Session()

        self.session.headers.update(
            {
                "User-Agent": (
                    "PAL-Trading-Buddy/2.0 "
                    "MacroNewsProvider"
                ),
                "Accept": "application/json",
            }
        )

        # ------------------------------------------------------
        # Instance cache
        # ------------------------------------------------------

        self._cached_articles: list[
            dict[str, Any]
        ] = []

        self._last_successful_fetch = 0.0

    # ==========================================================
    # GDELT REQUEST
    # ==========================================================

    def _request(self) -> dict[str, Any]:

        params = {
            "query": self.QUERY,
            "mode": "artlist",
            "format": "json",
            "maxrecords": self.MAX_RECORDS,
            "timespan": self.TIMESpan,
            "sort": "datedesc",
        }

        response = self.session.get(
            self.BASE_URL,
            params=params,
            timeout=self.REQUEST_TIMEOUT,
        )

        response.raise_for_status()

        # GDELT can occasionally return an empty or
        # non-JSON response.
        if not response.text.strip():

            raise RuntimeError(
                "GDELT returned an empty response."
            )

        try:

            payload = response.json()

        except ValueError as ex:

            raise RuntimeError(
                "GDELT returned invalid JSON."
            ) from ex

        if not isinstance(
            payload,
            dict,
        ):

            raise RuntimeError(
                "GDELT returned an unexpected response."
            )

        return payload

    # ==========================================================
    # DATETIME
    # ==========================================================

    @staticmethod
    def _parse_datetime(value):

        if not value:
            return None

        value = str(value).strip()

        formats = [
            "%Y%m%dT%H%M%SZ",
            "%Y%m%d%H%M%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
        ]

        for fmt in formats:

            try:

                parsed = datetime.strptime(
                    value,
                    fmt,
                )

                if parsed.tzinfo is None:

                    parsed = parsed.replace(
                        tzinfo=timezone.utc
                    )

                return parsed.astimezone(
                    timezone.utc
                )

            except ValueError:

                continue

        return None

    # ==========================================================
    # CURRENCY DETECTION
    # ==========================================================

    @staticmethod
    def _detect_currency(
        title: str,
        domain: str,
    ) -> str:

        text = (
            f"{title} {domain}"
        ).lower()

        gbp_terms = [
            "bank of england",
            "boe",
            "united kingdom",
            "uk ",
            "britain",
            "british",
            "pound",
            "sterling",
            "gbp",
        ]

        usd_terms = [
            "federal reserve",
            "fomc",
            "fed ",
            "united states",
            "us ",
            "american",
            "dollar",
            "usd",
        ]

        gbp_score = sum(
            1
            for term in gbp_terms
            if term in text
        )

        usd_score = sum(
            1
            for term in usd_terms
            if term in text
        )

        if gbp_score > usd_score:

            return "GBP"

        if usd_score > gbp_score:

            return "USD"

        return "USD/GBP"

    # ==========================================================
    # IMPACT DETECTION
    # ==========================================================

    @staticmethod
    def _detect_impact(
        title: str,
    ) -> str:

        title_lower = title.lower()

        high_terms = [
            "federal reserve",
            "fomc",
            "interest rate",
            "rate decision",
            "bank of england",
            "boe",
            "cpi",
            "inflation",
            "pce",
            "nonfarm payroll",
            "nfp",
            "unemployment",
            "gdp",
        ]

        medium_terms = [
            "retail sales",
            "jobless claims",
            "pmi",
            "employment",
            "wages",
            "consumer confidence",
            "consumer sentiment",
            "manufacturing",
            "services",
        ]

        for term in high_terms:

            if term in title_lower:

                return "HIGH"

        for term in medium_terms:

            if term in title_lower:

                return "MEDIUM"

        return "LOW"

    # ==========================================================
    # NORMALIZE ARTICLE
    # ==========================================================

    def _normalize_article(
        self,
        article: dict[str, Any],
    ) -> dict[str, Any] | None:

        if not isinstance(
            article,
            dict,
        ):

            return None

        title = str(
            article.get(
                "title",
                "",
            )
        ).strip()

        if not title:

            return None

        published_raw = (
            article.get("seendate")
            or article.get("published")
            or article.get("date")
        )

        published = self._parse_datetime(
            published_raw
        )

        if published is None:

            return None

        url = str(
            article.get(
                "url",
                "",
            )
        ).strip()

        domain = str(
            article.get(
                "domain",
                "",
            )
        ).strip()

        language = str(
            article.get(
                "language",
                "",
            )
        ).strip()

        currency = (
            self._detect_currency(
                title=title,
                domain=domain,
            )
        )

        impact = self._detect_impact(
            title
        )

        return {
            "id": url,

            "title": title,

            "currency": currency,

            "impact": impact,

            "published": (
                published.isoformat()
            ),

            "source": domain,

            "url": url,

            "language": language,
        }

    # ==========================================================
    # DEDUPLICATION
    # ==========================================================

    @staticmethod
    def _deduplicate(
        articles: list[
            dict[str, Any]
        ],
    ) -> list[
        dict[str, Any]
    ]:

        seen = set()

        result = []

        for article in articles:

            key = (
                article.get("url")
                or article.get(
                    "title",
                    "",
                ).lower()
            )

            if not key:

                continue

            if key in seen:

                continue

            seen.add(key)

            result.append(article)

        return result

    # ==========================================================
    # CACHE CHECK
    # ==========================================================

    def _cache_is_fresh(self) -> bool:

        if not self._cached_articles:

            return False

        age = (
            time.monotonic()
            - self._last_successful_fetch
        )

        return age < self.CACHE_SECONDS

    # ==========================================================
    # GET NEWS
    # ==========================================================

    def get_news(
        self,
        timespan: str = "24h",
    ) -> list[dict[str, Any]]:

        # ------------------------------------------------------
        # IMPORTANT:
        #
        # If the cache is still fresh, DO NOT call GDELT.
        #
        # This means your frontend can request PAL every
        # 5 seconds without hammering the external provider.
        # ------------------------------------------------------

        if self._cache_is_fresh():

            return list(
                self._cached_articles
            )

        # ------------------------------------------------------
        # Fetch fresh news
        # ------------------------------------------------------

        try:

            payload = self._request()

            raw_articles = payload.get(
                "articles",
                [],
            )

            if not isinstance(
                raw_articles,
                list,
            ):

                raise RuntimeError(
                    "GDELT returned no article list."
                )

            articles = []

            for raw_article in raw_articles:

                normalized = (
                    self._normalize_article(
                        raw_article
                    )
                )

                if normalized is not None:

                    articles.append(
                        normalized
                    )

            articles = self._deduplicate(
                articles
            )

            # Newest first.
            articles.sort(
                key=lambda article: article.get(
                    "published",
                    "",
                ),
                reverse=True,
            )

            # Keep the dashboard compact.
            articles = articles[:15]

            # --------------------------------------------------
            # Only replace the cache after a SUCCESSFUL request.
            # --------------------------------------------------

            self._cached_articles = articles

            self._last_successful_fetch = (
                time.monotonic()
            )

            logger.info(
                "GDELT macro news refreshed: %s articles",
                len(articles),
            )

            return list(
                self._cached_articles
            )

        except Exception as ex:

            # --------------------------------------------------
            # IMPORTANT:
            #
            # If GDELT fails, return the previous successful
            # cache instead of destroying it.
            # --------------------------------------------------

            logger.warning(
                "GDELT news refresh failed: %s",
                ex,
            )

            if self._cached_articles:

                logger.info(
                    "Using cached GDELT news: %s articles",
                    len(
                        self._cached_articles
                    ),
                )

                return list(
                    self._cached_articles
                )

            # No successful fetch yet.
            return []