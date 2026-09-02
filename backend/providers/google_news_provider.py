import logging
import time
import xml.etree.ElementTree as ET

from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import requests


logger = logging.getLogger(__name__)


class GoogleNewsProvider:
    """High-signal macro news collector for PAL.

    Google News is used as a transport/aggregator. The query set deliberately
    includes Reuters and official central-bank/economic sources so PAL receives
    the same kind of high-impact macro headlines used in professional briefs.
    """

    BASE_URL = "https://news.google.com/rss/search"
    REQUEST_TIMEOUT = 15
    REQUEST_DELAY = 0.5
    MAX_AGE_HOURS = 72
    MAX_PER_QUERY = 6
    MAX_TOTAL = 30

    QUERIES = {
        "USD": (
            '("Federal Reserve" OR FOMC OR "Fed rate" OR "US inflation" OR "US CPI" '
            'OR "US PCE" OR "US PPI" OR "US jobs" OR "nonfarm payrolls" OR NFP '
            'OR "US unemployment" OR "US GDP" OR "US retail sales" OR "US Treasury") '
            'AND (USD OR dollar OR "United States" OR US)'
        ),
        "GBP": (
            '("Bank of England" OR BoE OR "BoE rate" OR "UK inflation" OR "UK CPI" '
            'OR "UK PPI" OR "UK employment" OR "UK jobs" OR "UK wages" OR "UK GDP" '
            'OR "UK retail sales" OR "UK PMI") '
            'AND (GBP OR pound OR sterling OR "United Kingdom" OR UK)'
        ),
        "CROSS": (
            '("GBP/USD" OR GBPUSD OR "GBP USD" OR "British pound" OR sterling) '
            'AND (dollar OR USD OR "Federal Reserve" OR Fed OR "Bank of England" OR BoE)'
        ),
        # Direct high-signal Reuters searches. Google News returns the original
        # publisher/source metadata, so PAL can weight Reuters above aggregators.
        "USD_REUTERS": 'site:reuters.com (Fed OR FOMC OR dollar OR USD OR "Treasury yields" OR inflation OR jobs)',
        "GBP_REUTERS": 'site:reuters.com ("Bank of England" OR sterling OR pound OR GBP OR UK inflation OR UK jobs)',
        "CROSS_REUTERS": 'site:reuters.com ("GBP/USD" OR GBPUSD OR sterling dollar OR pound dollar)',
        # Official central-bank and macro channels are evidence, not opinion.
        "FED_OFFICIAL": 'site:federalreserve.gov (FOMC OR "monetary policy" OR inflation OR employment OR rates)',
        "BOE_OFFICIAL": 'site:bankofengland.co.uk ("Monetary Policy" OR inflation OR wages OR employment OR rates)',
        "BEA_OFFICIAL": 'site:bea.gov (GDP OR "Personal Income" OR PCE OR "Personal Consumption" OR trade)',
        "CENSUS_OFFICIAL": 'site:census.gov ("Retail Sales" OR "Durable Goods" OR "New Orders" OR trade)',
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36",
            "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        })

    def get_headlines(self) -> list[dict]:
        all_headlines: list[dict] = []
        for bucket, query in self.QUERIES.items():
            try:
                articles = self._request_feed(query, bucket)
                all_headlines.extend(articles[: self.MAX_PER_QUERY])
                time.sleep(self.REQUEST_DELAY)
            except Exception as ex:
                logger.warning("Google News request failed for %s: %s", bucket, ex)
        unique = self._deduplicate(all_headlines)
        unique.sort(key=self._sort_key, reverse=True)
        return unique[: self.MAX_TOTAL]

    def _request_feed(self, query: str, bucket: str) -> list[dict]:
        url = f"{self.BASE_URL}?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
        response = self.session.get(url, timeout=self.REQUEST_TIMEOUT)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        channel = root.find("channel")
        if channel is None:
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.MAX_AGE_HOURS)
        results = []
        for item in channel.findall("item"):
            title = self._text(item.find("title"))
            link = self._text(item.find("link"))
            published_raw = self._text(item.find("pubDate"))
            source_node = item.find("source")
            source = (source_node.text or "").strip() if source_node is not None else ""
            if not title:
                continue
            published_at = self._parse_datetime(published_raw)
            if published_at and published_at < cutoff:
                continue
            if self._is_low_quality_source(source):
                continue
            currency = self._currency_for_bucket(bucket, title)
            impact = self._impact(title, bucket)
            results.append({
                "id": f"{title}|{link}",
                "title": title,
                "currency": currency,
                "impact": impact,
                "source": source,
                "published_at": published_at.isoformat() if published_at else published_raw,
                "url": link,
                "provider": "Google News",
                "collection_bucket": bucket,
            })
        return results

    @staticmethod
    def _currency_for_bucket(bucket: str, title: str) -> str:
        if bucket.startswith("USD") or bucket == "FED_OFFICIAL" or bucket in {"BEA_OFFICIAL", "CENSUS_OFFICIAL"}:
            return "USD"
        if bucket.startswith("GBP") or bucket == "BOE_OFFICIAL":
            return "GBP"
        if bucket.startswith("CROSS"):
            return "CROSS"
        text = title.lower()
        if any(x in text for x in ("bank of england", "boe", "sterling", "pound", "uk ", "britain")):
            return "GBP"
        if any(x in text for x in ("federal reserve", "fomc", "fed ", "dollar", "us ", "u.s.")):
            return "USD"
        return "CROSS"

    @staticmethod
    def _impact(title: str, bucket: str) -> str:
        text = title.lower()
        high = ("fomc", "federal reserve", "bank of england", "boe", "cpi", "inflation", "pce", "payroll", "nfp", "unemployment", "gdp", "rate decision", "rate cut", "rate hike")
        medium = ("retail sales", "jobless claims", "pmi", "employment", "wages", "treasury yields", "personal income", "consumer")
        if any(term in text for term in high) or bucket.endswith("_OFFICIAL"):
            return "High"
        if any(term in text for term in medium):
            return "Medium"
        return "Low"

    @staticmethod
    def _is_low_quality_source(source: str) -> bool:
        blocked = {"bitcoin world", "crypto briefing", "cryptorank", "devdiscourse"}
        return source.strip().lower() in blocked

    @staticmethod
    def _parse_datetime(value: str):
        if not value:
            return None
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _text(node) -> str:
        return (node.text or "").strip() if node is not None else ""

    @staticmethod
    def _deduplicate(headlines: list[dict]) -> list[dict]:
        seen = set(); unique = []
        for headline in headlines:
            key = str(headline.get("title", "")).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key); unique.append(headline)
        return unique

    @staticmethod
    def _sort_key(headline: dict):
        return str(headline.get("published_at", ""))
