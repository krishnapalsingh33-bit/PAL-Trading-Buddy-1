import logging
import time
import xml.etree.ElementTree as ET

from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import requests


logger = logging.getLogger(__name__)


class GoogleNewsProvider:
    """
    Google News RSS provider for PAL Macro Intelligence.

    Provides separate macro-news buckets for:

        USD
        GBP
        CROSS

    This provider only collects news.

    It does NOT:
        - analyze charts
        - generate trade setups
        - generate entries
        - determine trade readiness
        - make trading decisions
    """

    BASE_URL = "https://news.google.com/rss/search"

    REQUEST_TIMEOUT = 15

    REQUEST_DELAY = 1.0

    # Only keep genuinely recent news.
    MAX_AGE_HOURS = 72

    # Maximum results returned from each bucket.
    MAX_PER_BUCKET = 5

    # Final maximum number of headlines.
    MAX_TOTAL = 15

    QUERIES = {

        # ======================================================
        # USD MACRO
        # ======================================================

        "USD": (
            '('
            '"Federal Reserve" OR '
            'FOMC OR '
            '"Fed rate" OR '
            '"US inflation" OR '
            '"US CPI" OR '
            '"US PCE" OR '
            '"US PPI" OR '
            '"US jobs" OR '
            '"nonfarm payrolls" OR '
            'NFP OR '
            '"US unemployment" OR '
            '"US GDP" OR '
            '"US retail sales" OR '
            '"US Treasury"'
            ') '
            'AND '
            '('
            'USD OR dollar OR '
            '"United States" OR US'
            ')'
        ),

        # ======================================================
        # GBP MACRO
        # ======================================================

        "GBP": (
            '('
            '"Bank of England" OR '
            'BoE OR '
            '"BoE rate" OR '
            '"UK inflation" OR '
            '"UK CPI" OR '
            '"UK PPI" OR '
            '"UK employment" OR '
            '"UK jobs" OR '
            '"UK wages" OR '
            '"UK GDP" OR '
            '"UK retail sales" OR '
            '"UK PMI" OR '
            '"UK Treasury"'
            ') '
            'AND '
            '('
            'GBP OR pound OR sterling OR '
            '"United Kingdom" OR UK'
            ')'
        ),

        # ======================================================
        # GBP/USD CROSS
        # ======================================================

        "CROSS": (
            '('
            '"GBP/USD" OR '
            'GBPUSD OR '
            '"GBP USD" OR '
            '"British pound" OR '
            'sterling'
            ') '
            'AND '
            '('
            'dollar OR USD OR '
            '"Federal Reserve" OR '
            'Fed OR '
            '"Bank of England" OR '
            'BoE'
            ')'
        ),
    }

    def __init__(self):

        self.session = requests.Session()

        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/151.0 Safari/537.36"
                )
            }
        )

    # ==========================================================
    # PUBLIC
    # ==========================================================

    def get_headlines(self) -> list[dict]:
        """
        Fetch recent macro headlines.

        Each bucket is processed independently so that
        CROSS news cannot dominate USD or GBP news.
        """

        all_headlines = []

        for currency, query in self.QUERIES.items():

            try:

                bucket = self._request_feed(
                    query=query,
                    currency=currency,
                )

                # Keep each bucket independent.
                bucket = bucket[
                    : self.MAX_PER_BUCKET
                ]

                all_headlines.extend(
                    bucket
                )

                time.sleep(
                    self.REQUEST_DELAY
                )

            except Exception as ex:

                logger.warning(
                    "Google News request failed for %s: %s",
                    currency,
                    ex,
                )

        # Remove duplicates across buckets.
        all_headlines = self._deduplicate(
            all_headlines
        )

        # Newest first.
        all_headlines.sort(
            key=self._sort_key,
            reverse=True,
        )

        return all_headlines[
            : self.MAX_TOTAL
        ]

    # ==========================================================
    # RSS REQUEST
    # ==========================================================

    def _request_feed(
        self,
        query: str,
        currency: str,
    ) -> list[dict]:

        encoded_query = quote_plus(
            query
        )

        url = (
            f"{self.BASE_URL}"
            f"?q={encoded_query}"
            f"&hl=en-US"
            f"&gl=US"
            f"&ceid=US:en"
        )

        response = self.session.get(
            url,
            timeout=self.REQUEST_TIMEOUT,
        )

        response.raise_for_status()

        root = ET.fromstring(
            response.content
        )

        channel = root.find(
            "channel"
        )

        if channel is None:
            return []

        results = []

        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(
                hours=self.MAX_AGE_HOURS
            )
        )

        for item in channel.findall(
            "item"
        ):

            title = self._text(
                item.find("title")
            )

            link = self._text(
                item.find("link")
            )

            published_raw = self._text(
                item.find("pubDate")
            )

            source_node = item.find(
                "source"
            )

            source = ""

            if source_node is not None:

                source = (
                    source_node.text
                    or ""
                ).strip()

            if not title:
                continue

            published_at = (
                self._parse_datetime(
                    published_raw
                )
            )

            # Ignore articles that are too old.
            if (
                published_at
                and published_at < cutoff
            ):
                continue

            # Ignore obvious low-value sources.
            if self._is_low_quality_source(
                source
            ):
                continue

            results.append(
                {
                    "id": self._make_id(
                        title,
                        link,
                    ),

                    "title": title,

                    "currency": currency,

                    "source": source,

                    "published_at": (
                        published_at.isoformat()
                        if published_at
                        else published_raw
                    ),

                    "url": link,

                    "provider": "Google News",
                }
            )

        return results

    # ==========================================================
    # SOURCE FILTER
    # ==========================================================

    @staticmethod
    def _is_low_quality_source(
        source: str,
    ) -> bool:

        source_lower = (
            source.strip().lower()
        )

        if not source_lower:
            return False

        blocked = {
            "bitcoin world",
            "crypto briefing",
            "cryptorank",
            "devdiscourse",
        }

        return source_lower in blocked

    # ==========================================================
    # DATETIME
    # ==========================================================

    @staticmethod
    def _parse_datetime(
        value: str,
    ):

        if not value:
            return None

        try:

            parsed = (
                parsedate_to_datetime(
                    value
                )
            )

            if parsed.tzinfo is None:

                parsed = (
                    parsed.replace(
                        tzinfo=timezone.utc
                    )
                )

            return parsed.astimezone(
                timezone.utc
            )

        except (
            TypeError,
            ValueError,
        ):

            return None

    # ==========================================================
    # TEXT
    # ==========================================================

    @staticmethod
    def _text(node) -> str:

        if node is None:
            return ""

        return (
            node.text
            or ""
        ).strip()

    # ==========================================================
    # ID
    # ==========================================================

    @staticmethod
    def _make_id(
        title: str,
        url: str,
    ) -> str:

        return (
            f"{title}|{url}"
        )

    # ==========================================================
    # DEDUPLICATION
    # ==========================================================

    @staticmethod
    def _deduplicate(
        headlines: list[dict],
    ) -> list[dict]:

        seen = set()

        unique = []

        for headline in headlines:

            title = (
                headline.get(
                    "title",
                    "",
                )
                .strip()
                .lower()
            )

            if not title:
                continue

            if title in seen:
                continue

            seen.add(title)

            unique.append(
                headline
            )

        return unique

    # ==========================================================
    # SORT
    # ==========================================================

    @staticmethod
    def _sort_key(
        headline: dict,
    ):

        value = headline.get(
            "published_at",
            "",
        )

        if not value:
            return ""

        return value