from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

import requests


class PublicFredProvider:
    """Public FRED graph CSV fallback that does not require an API key."""

    URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
    SERIES = {
        "fed_funds": "FEDFUNDS",
        "us_2y": "DGS2",
        "us_10y": "DGS10",
        "us_10y_2y_spread": "T10Y2Y",
        "vix": "VIXCLS",
    }

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (public FRED fallback)",
            "Accept": "text/csv,text/plain,*/*",
        })

    @staticmethod
    def _number(value: Any) -> float | None:
        if value in (None, "", "."):
            return None
        try:
            number = float(value)
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    def get_snapshot(self) -> dict[str, list[dict[str, Any]]]:
        response = self.session.get(
            self.URL,
            params={"id": ",".join(self.SERIES.values())},
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()

        reader = csv.DictReader(io.StringIO(response.text))
        rows_by_series = {name: [] for name in self.SERIES}
        reverse = {series_id: name for name, series_id in self.SERIES.items()}

        for row in reader:
            date = str(row.get("observation_date", "")).strip()
            if not date:
                continue
            try:
                datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

            for series_id, name in reverse.items():
                value = self._number(row.get(series_id))
                if value is None:
                    continue
                rows_by_series[name].append({
                    "date": date,
                    "value": value,
                    "source": "Federal Reserve Bank of St. Louis / FRED",
                    "series": series_id,
                })

        return {name: rows for name, rows in rows_by_series.items() if rows}
