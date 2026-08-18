from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import requests


class TreasuryYieldProvider:
    """Official U.S. Treasury daily par-yield fallback for 2Y/10Y."""

    URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (official Treasury rates)",
            "Accept": "application/xml,text/xml,*/*",
        })

    @staticmethod
    def _number(value: Any) -> float | None:
        if value in (None, "", "N/A"):
            return None
        try:
            number = float(str(value).replace(",", "").strip())
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    def get_snapshot(self) -> dict[str, list[dict[str, Any]]]:
        year = datetime.now(timezone.utc).year
        response = self.session.get(
            self.URL,
            params={"data": "daily_treasury_yield_curve", "field_tdr_date_value": year},
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        xml = response.text
        observations = {"us_2y": [], "us_10y": []}

        for item in re.findall(r"<item>(.*?)</item>", xml, flags=re.I | re.S):
            date_match = re.search(r"<(?:\w+:)?NEW_DATE>(.*?)</(?:\w+:)?NEW_DATE>", item, flags=re.I | re.S)
            if not date_match:
                continue
            date = re.sub(r"<[^>]+>", "", date_match.group(1)).strip()

            def value(tag: str) -> float | None:
                match = re.search(rf"<(?:\w+:)?{tag}>(.*?)</(?:\w+:)?{tag}>", item, flags=re.I | re.S)
                return self._number(re.sub(r"<[^>]+>", "", match.group(1)).strip()) if match else None

            two = value("BC_2YEAR")
            ten = value("BC_10YEAR")
            if two is not None:
                observations["us_2y"].append({"date": date, "value": two, "source": "U.S. Department of the Treasury", "series": "2-Year Treasury Par Yield"})
            if ten is not None:
                observations["us_10y"].append({"date": date, "value": ten, "source": "U.S. Department of the Treasury", "series": "10-Year Treasury Par Yield"})

        return {key: rows[-24:] for key, rows in observations.items() if rows}
