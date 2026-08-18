from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import requests


class OfficialPolicyProvider:
    """Read current policy-rate facts from official central-bank pages."""

    FED_URL = "https://www.federalreserve.gov/economy-at-a-glance-policy-rate.htm"
    BOE_URL = "https://www.bankofengland.co.uk/monetary-policy"

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
                "Accept": "text/html,application/xhtml+xml",
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
            response = self.session.get(self.FED_URL, timeout=self.timeout_seconds)
            response.raise_for_status()
            text = self._clean(response.text)
            match = re.search(r"Target Range for the Federal Funds Rate.*?(\d+\.\d+)%\s*to\s*(\d+\.\d+)%", text, re.I | re.S)
            if not match:
                match = re.search(r"Federal Funds Rate Target Range.*?(\d+\.\d+)%\s*to\s*(\d+\.\d+)%", text, re.I | re.S)
            if not match:
                raise RuntimeError("Fed target range was not found on the official page.")
            return {
                "policy_rate_lower": float(match.group(1)),
                "policy_rate_upper": float(match.group(2)),
                "policy_rate": (float(match.group(1)) + float(match.group(2))) / 2,
                "currency": "USD",
                "source": "Federal Reserve",
                "status": "CURRENT",
            }
        except Exception as exc:
            return {"currency": "USD", "source": "Federal Reserve", "status": "UNAVAILABLE", "reason": str(exc)}

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
