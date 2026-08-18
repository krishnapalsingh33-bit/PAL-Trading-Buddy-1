from __future__ import annotations

import calendar
import html
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

import requests


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if text:
            self.parts.append(text)

    def text(self) -> str:
        return "\n".join(self.parts)


class OfficialCalendarProvider:
    """Official-source calendar fallback for USD/GBP macro events.

    Sources:
      - U.S. Bureau of Labor Statistics release schedule
      - Federal Reserve FOMC calendar
      - UK Office for National Statistics release search API
    """

    BLS_MONTH_URL = "https://www.bls.gov/schedule/{year:04d}/{month:02d}_sched_list.htm"
    FED_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
    ONS_URL = "https://api.beta.ons.gov.uk/v1/search/releases"

    BLS_HIGH = (
        "Consumer Price Index",
        "Employment Situation",
        "Producer Price Index",
        "Retail Sales",
        "Productivity and Costs",
        "Job Openings and Labor Turnover Survey",
        "U.S. Import and Export Price Indexes",
    )

    ONS_HIGH = (
        "consumer price inflation",
        "cpi",
        "labour market",
        "earnings and employment",
        "retail sales",
        "gdp",
        "producer price inflation",
        "services producer price inflation",
    )

    def __init__(self, timeout_seconds: float = 15.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.2 (official macro calendar)",
                "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            }
        )

    def get_events(self, days_before: int = 1, days_after: int = 30) -> list[dict]:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days_before)
        end = now + timedelta(days=days_after)
        events: list[dict] = []
        events.extend(self._get_bls_events(start, end))
        events.extend(self._get_fed_events(start, end))
        events.extend(self._get_ons_events(start, end))

        unique: dict[tuple[str, str, str], dict] = {}
        for event in events:
            key = (event["title"], event["currency"], event["time"])
            unique[key] = event

        result = list(unique.values())
        result.sort(key=lambda item: item["time"])
        return result

    def _get_bls_events(self, start: datetime, end: datetime) -> list[dict]:
        events: list[dict] = []
        cursor = start.date().replace(day=1)
        end_month = end.date().replace(day=1)

        while cursor <= end_month:
            url = self.BLS_MONTH_URL.format(year=cursor.year, month=cursor.month)
            try:
                response = self.session.get(url, timeout=self.timeout_seconds)
                response.raise_for_status()
                text = self._html_text(response.text)
                events.extend(self._parse_bls_text(text, cursor.year, cursor.month, start, end))
            except Exception:
                pass
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)
        return events

    def _parse_bls_text(self, text: str, year: int, month: int, start: datetime, end: datetime) -> list[dict]:
        pattern = re.compile(
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+"
            r"([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+"
            r"(\d{1,2}:\d{2})\s+(AM|PM)\s+([^\n]+)",
            re.IGNORECASE,
        )
        events: list[dict] = []
        eastern = ZoneInfo("America/New_York")
        for match in pattern.finditer(text):
            month_name, day, event_year, clock, ampm, title = match.groups()
            title = " ".join(html.unescape(title).split())
            if not self._is_relevant_bls(title):
                continue
            try:
                local = datetime.strptime(
                    f"{month_name} {day} {event_year} {clock} {ampm}",
                    "%B %d %Y %I:%M %p",
                ).replace(tzinfo=eastern)
            except ValueError:
                continue
            event_time = local.astimezone(timezone.utc)
            if not (start <= event_time <= end):
                continue
            events.append(self._event(title, "USD", event_time, "High" if self._is_high_bls(title) else "Medium", "BLS"))
        return events

    def _get_fed_events(self, start: datetime, end: datetime) -> list[dict]:
        try:
            response = self.session.get(self.FED_URL, timeout=self.timeout_seconds)
            response.raise_for_status()
            text = self._html_text(response.text)
        except Exception:
            return []

        events: list[dict] = []
        eastern = ZoneInfo("America/New_York")
        month_names = {name.lower(): index for index, name in enumerate(calendar.month_name) if name}
        pattern = re.compile(
            r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2})\b",
            re.IGNORECASE,
        )
        for match in pattern.finditer(text):
            month, first_day, second_day = match.groups()
            try:
                year = int(re.search(r"202[0-9]", text[max(0, match.start() - 120):match.start() + 120]).group())
                local = datetime(year, month_names[month.lower()], int(second_day), 14, 0, tzinfo=eastern)
            except (ValueError, AttributeError, KeyError):
                continue
            event_time = local.astimezone(timezone.utc)
            if start <= event_time <= end:
                title = "Federal Reserve FOMC interest rate decision"
                events.append(self._event(title, "USD", event_time, "High", "Federal Reserve"))
        return events

    def _get_ons_events(self, start: datetime, end: datetime) -> list[dict]:
        try:
            response = self.session.get(
                self.ONS_URL,
                params={
                    "limit": 100,
                    "sort": "release_date_asc",
                    "fromDate": start.date().isoformat(),
                    "toDate": end.date().isoformat(),
                    "release-type": "type-upcoming",
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        items = payload.get("results") or payload.get("items") or payload.get("releases") or []
        events: list[dict] = []
        london = ZoneInfo("Europe/London")
        for item in items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or item.get("description") or "").strip()
            normalized = title.lower()
            if not title or not any(term in normalized for term in self.ONS_HIGH):
                continue
            raw_date = item.get("release_date") or item.get("releaseDate") or item.get("date")
            if not raw_date:
                continue
            try:
                if "T" in str(raw_date):
                    parsed = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=london)
                else:
                    parsed = datetime.fromisoformat(str(raw_date)).replace(hour=7, minute=0, tzinfo=london)
                event_time = parsed.astimezone(timezone.utc)
            except ValueError:
                continue
            if not (start <= event_time <= end):
                continue
            impact = "High" if any(term in normalized for term in self.ONS_HIGH[:6]) else "Medium"
            events.append(self._event(title, "GBP", event_time, impact, "UK Office for National Statistics"))
        return events

    @staticmethod
    def _html_text(value: str) -> str:
        parser = _TextParser()
        parser.feed(value)
        return parser.text()

    @classmethod
    def _is_relevant_bls(cls, title: str) -> bool:
        normalized = title.lower()
        return any(term.lower() in normalized for term in cls.BLS_HIGH)

    @classmethod
    def _is_high_bls(cls, title: str) -> bool:
        normalized = title.lower()
        return any(term.lower() in normalized for term in ("consumer price index", "employment situation", "producer price index"))

    @staticmethod
    def _event(title: str, currency: str, event_time: datetime, impact: str, source: str) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "id": f"{source}:{currency}:{title}:{event_time.isoformat()}",
            "title": title,
            "currency": currency,
            "time": event_time.isoformat(),
            "impact": impact,
            "category": "macro",
            "actual": None,
            "forecast": None,
            "previous": None,
            "country": "United States" if currency == "USD" else "United Kingdom",
            "source": source,
            "minutes": round((event_time - now).total_seconds() / 60),
        }
