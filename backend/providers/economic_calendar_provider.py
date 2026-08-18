import logging
import os
from datetime import datetime, timezone, timedelta

import requests
from dotenv import load_dotenv


load_dotenv()


logger = logging.getLogger(__name__)


class EconomicCalendarProvider:
    BASE_URL = "https://api.apify.com/v2/datasets"

    IMPORTANT_CURRENCIES = {"USD", "GBP"}

    IMPORTANT_EVENTS = {
        "NON-FARM PAYROLLS", "NONFARM PAYROLLS", "UNEMPLOYMENT RATE",
        "CONSUMER PRICE INDEX", "CPI", "PRODUCER PRICE INDEX", "PPI",
        "CORE PCE", "PERSONAL CONSUMPTION EXPENDITURES", "FEDERAL FUNDS RATE",
        "FED INTEREST RATE DECISION", "FOMC", "INTEREST RATE DECISION",
        "BANK OF ENGLAND BANK RATE", "BOE", "BANK OF ENGLAND",
        "GROSS DOMESTIC PRODUCT", "GDP", "RETAIL SALES", "INITIAL JOBLESS CLAIMS",
        "AVERAGE HOURLY EARNINGS", "AVERAGE EARNINGS GROWTH",
        "MANUFACTURING PMI", "SERVICES PMI", "PMI", "CONSUMER SENTIMENT",
        "CONSUMER CONFIDENCE", "CORE PCE PRICE INDEX",
    }

    def __init__(self):
        self.api_token = os.getenv("APIFY_API_TOKEN", "").strip()
        self.dataset_id = os.getenv("APIFY_DATASET_ID", "lrwQhwrbq85alEVZz").strip()
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "PAL-Trading-Buddy/2.0"})

    @staticmethod
    def _parse_datetime(value):
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _currency(country):
        value = str(country or "").strip().upper()
        if value in {"US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"}:
            return "USD"
        if value in {"UK", "GB", "GBR", "UNITED KINGDOM"}:
            return "GBP"
        return ""

    @staticmethod
    def _event_title(item):
        title = item.get("eventName") or item.get("Event") or item.get("event") or item.get("title") or item.get("Category") or item.get("category") or ""
        return str(title).strip()

    @classmethod
    def _normalize_impact(cls, item, title):
        raw_impact = item.get("impactStars") if item.get("impactStars") is not None else item.get("Importance")
        try:
            stars = int(raw_impact)
        except (TypeError, ValueError):
            stars = 0
        normalized_title = title.upper().replace("-", " ").strip()
        for important in cls.IMPORTANT_EVENTS:
            if important in normalized_title:
                return "High"
        if stars >= 3:
            return "High"
        if stars == 2:
            return "Medium"
        return "Low"

    @classmethod
    def _normalize_event(cls, item):
        if not isinstance(item, dict):
            return None
        country = item.get("country") or item.get("Country") or ""
        currency = cls._currency(country)
        if currency not in cls.IMPORTANT_CURRENCIES:
            return None
        event_time = cls._parse_datetime(item.get("releaseDateTime") or item.get("ReleaseDateTime") or item.get("Date") or item.get("date"))
        if event_time is None:
            return None
        title = cls._event_title(item)
        if not title:
            return None
        category = item.get("category") or item.get("Category") or ""
        actual = item.get("actualValueDisplay") if item.get("actualValueDisplay") is not None else item.get("Actual")
        forecast = item.get("forecastValue") if item.get("forecastValue") is not None else item.get("Forecast")
        previous = item.get("previousValueDisplay") if item.get("previousValueDisplay") is not None else item.get("Previous")
        return {
            "id": str(item.get("id") or item.get("CalendarId") or ""),
            "title": title,
            "currency": currency,
            "time": event_time,
            "impact": cls._normalize_impact(item, title),
            "category": str(category),
            "actual": actual,
            "forecast": forecast,
            "previous": previous,
            "country": str(country),
            "source": "Apify",
        }

    def _fetch_dataset(self):
        # Apify is optional. The API route will use the official calendar fallback
        # when this provider is not configured or returns no events.
        if not self.api_token:
            logger.info("Apify calendar not configured; using official calendar fallback.")
            return []

        url = f"{self.BASE_URL}/{self.dataset_id}/items"
        response = self.session.get(
            url,
            params={"token": self.api_token, "format": "json"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else []

    def get_events(self, days_before=1, days_after=7):
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days_before)
        end = now + timedelta(days=days_after)
        try:
            raw_events = self._fetch_dataset()
        except Exception as exc:
            logger.warning("Apify calendar unavailable: %s", exc)
            return []

        events = []
        for item in raw_events:
            event = self._normalize_event(item)
            if event is None:
                continue
            event_time = event["time"]
            if event_time < start or event_time > end:
                continue
            event["time"] = event_time.isoformat()
            event["minutes"] = round((event_time - now).total_seconds() / 60)
            events.append(event)

        unique = {}
        for event in events:
            unique[(event["title"], event["currency"], event["time"])] = event
        events = list(unique.values())
        events.sort(key=lambda event: event["time"])
        return events
