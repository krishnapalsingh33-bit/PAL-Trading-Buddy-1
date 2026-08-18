from __future__ import annotations

import csv
import io
import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)


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
        """Fetch series independently; one failed series must not hide all others."""
        observations: dict[str, list[dict[str, Any]]] = {}
        failures: list[str] = []
        for name, series_id in self.SERIES.items():
            try:
                response = self.session.get(self.URL, params={"id": series_id}, timeout=self.timeout_seconds)
                response.raise_for_status()
                reader = csv.DictReader(io.StringIO(response.text))
                rows: list[dict[str, Any]] = []
                for row in reader:
                    date = str(row.get("observation_date", "")).strip()
                    value = self._number(row.get(series_id))
                    if date and value is not None:
                        rows.append({"date": date, "value": value, "source": "Federal Reserve Bank of St. Louis / FRED", "series": series_id})
                if rows:
                    observations[name] = rows[-24:]
                else:
                    failures.append(f"{series_id}: no usable observations")
            except Exception as exc:
                failures.append(f"{series_id}: {exc}")
                logger.warning("Public FRED series %s failed: %s", series_id, exc)
        if not observations:
            raise RuntimeError("Public FRED returned no usable observations: " + "; ".join(failures))
        if failures:
            logger.warning("Public FRED partial success: %s", "; ".join(failures))
        return observations
