from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any

import requests


class OfficialPolicyProvider:
    """Read current policy-rate facts from structured central-bank data."""

    # FRED publishes these daily target-range series with the Board of
    # Governors as the source. This avoids scraping changing Fed HTML markup.
    FED_FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARL,DFEDTARU"
    BOE_URL = "https://www.bankofengland.co.uk/monetary-policy"

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
                "Accept": "text/csv,text/html,application/xhtml+xml,application/json",
            }
        )

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "fed": self._fed(),
            "boe": self._boe(),
        }

    def _fed(self) -> dict[str, Any]:
        try:
            response = self.session.get(self.FED_FRED_URL, timeout=self.timeout_seconds)
            response.raise_for_status()
            rows = list(csv.DictReader(io.StringIO(response.text)))
            if not rows:
                raise RuntimeError("FRED returned no federal-funds target-range observations.")

            latest = rows[-1]
            lower_raw = latest.get("DFEDTARL")
            upper_raw = latest.get("DFEDTARU")
            if not lower_raw or not upper_raw or "." not in lower_raw or "." not in upper_raw:
                raise RuntimeError("FRED returned an incomplete federal-funds target range.")

            lower = float(lower_raw)
            upper = float(upper_raw)
            observation_date = latest.get("observation_date")
            return {
                "policy_rate_lower": lower,
                "policy_rate_upper": upper,
                "policy_rate": (lower + upper) / 2,
                "observation_date": observation_date,
                "currency": "USD",
                "source": "Federal Reserve via FRED",
                "status": "CURRENT",
            }
        except Exception as exc:
            return {
                "currency": "USD",
                "source": "Federal Reserve via FRED",
                "status": "UNAVAILABLE",
                "reason": str(exc),
            }

    def _boe(self) -> dict[str, Any]:
        try:
            response = self.session.get(self.BOE_URL, timeout=self.timeout_seconds)
            response.raise_for_status()
            text = self._clean(response.text)
            rate = re.search(r"Current Bank Rate\s*(\d+\.\d+)%", text, re.I)
            if not rate:
                rate = re.search(r"Bank Rate[^\d]*(\d+\.\d+)%", text, re.I)
            if not rate:
                raise RuntimeError("BoE Bank Rate was not found on the official page.")
            inflation = re.search(r"Current inflation rate\s*(\d+\.\d+)%", text, re.I)
            return {
                "policy_rate": float(rate.group(1)),
                "currency": "GBP",
                "inflation_rate": float(inflation.group(1)) if inflation else None,
                "source": "Bank of England",
                "status": "CURRENT",
            }
        except Exception as exc:
            return {"currency": "GBP", "source": "Bank of England", "status": "UNAVAILABLE", "reason": str(exc)}

    @staticmethod
    def _clean(value: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()
