from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any

import requests


class OfficialPolicyProvider:
    """Read current policy-rate facts from structured central-bank data."""

    FED_INDEX_URL = "https://www.federalreserve.gov/newsevents/pressreleases/2026-press-fomc.htm"
    FED_FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARL,DFEDTARU"
    BOE_URL = "https://www.bankofengland.co.uk/monetary-policy"

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
                "Accept": "text/html,application/xhtml+xml,text/csv,application/json",
            }
        )

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "fed": self._fed(),
            "boe": self._boe(),
        }

    @staticmethod
    def _rate_value(value: str) -> float:
        """Parse Fed rate notation such as 3-1/2 or 3.50."""
        value = value.strip().replace("−", "-")
        if re.fullmatch(r"\d+-\d+/\d+", value):
            whole, fraction = value.split("-", 1)
            numerator, denominator = fraction.split("/", 1)
            return float(whole) + (float(numerator) / float(denominator))
        return float(value)

    def _fed(self) -> dict[str, Any]:
        try:
            index = self.session.get(self.FED_INDEX_URL, timeout=self.timeout_seconds)
            index.raise_for_status()
            links = re.findall(r'href=["\']([^"\']*monetary2026\d{4}a\.htm)["\']', index.text, re.I)
            if not links:
                raise RuntimeError("No 2026 FOMC statement link was found on the official Fed release index.")

            latest_link = links[0]
            if latest_link.startswith("/"):
                statement_url = "https://www.federalreserve.gov" + latest_link
            elif latest_link.startswith("http"):
                statement_url = latest_link
            else:
                statement_url = "https://www.federalreserve.gov/newsevents/pressreleases/" + latest_link

            statement = self.session.get(statement_url, timeout=self.timeout_seconds)
            statement.raise_for_status()
            text = self._clean(statement.text)

            number = r"(?:\d+(?:\.\d+)?|\d+-\d+/\d+)"
            match = re.search(
                rf"target range for the federal funds rate at\s*({number})\s*(?:to|–|-)\s*({number})\s*percent",
                text,
                re.I,
            )
            if not match:
                raise RuntimeError("The latest official FOMC statement did not contain a target range.")

            lower = self._rate_value(match.group(1))
            upper = self._rate_value(match.group(2))

            # Capture the vote even if the exact sentence wording changes.
            vote = None
            vote_match = re.search(
                r"approved.*?statement.*?release.*?by\s+a\s+(\d+)\s*[–—-]\s*(\d+)\s+vote",
                text,
                re.I | re.S,
            )
            if not vote_match:
                vote_match = re.search(r"\b(\d+)\s*[–—-]\s*(\d+)\s+vote\b", text, re.I)
            if vote_match:
                vote = {"for": int(vote_match.group(1)), "against": int(vote_match.group(2))}

            release_date = None
            date_match = re.search(
                r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026",
                text,
            )
            if date_match:
                release_date = date_match.group(0)

            return {
                "policy_rate_lower": lower,
                "policy_rate_upper": upper,
                "policy_rate": (lower + upper) / 2,
                "release_date": release_date,
                "vote": vote,
                "statement_url": statement_url,
                "currency": "USD",
                "source": "Federal Reserve FOMC",
                "status": "CURRENT",
            }
        except Exception as official_exc:
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
                return {
                    "policy_rate_lower": lower,
                    "policy_rate_upper": upper,
                    "policy_rate": (lower + upper) / 2,
                    "observation_date": latest.get("observation_date"),
                    "currency": "USD",
                    "source": "Federal Reserve via FRED",
                    "status": "CURRENT",
                }
            except Exception as fallback_exc:
                return {
                    "currency": "USD",
                    "source": "Federal Reserve",
                    "status": "UNAVAILABLE",
                    "reason": f"Official FOMC: {official_exc}; FRED fallback: {fallback_exc}",
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
