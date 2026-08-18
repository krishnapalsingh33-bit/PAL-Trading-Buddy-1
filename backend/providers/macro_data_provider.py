from __future__ import annotations

import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from html import unescape
from typing import Any

import requests

logger = logging.getLogger(__name__)


class MacroDataProvider:
    BLS_V1_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
    BLS_V2_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
    ONS_BASE_URL = "https://api.beta.ons.gov.uk/v1"
    ONS_DATASET_URL = f"{ONS_BASE_URL}/datasets/cpih01"
    ONS_L522_DATA_URL = "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/l522/mm23"

    BLS_SERIES = {
        "us_cpi": "CUSR0000SA0",
        "us_core_cpi": "CUSR0000SA0L1E",
        "us_unemployment": "LNS14000000",
        "us_payrolls": "CES0000000001",
        "us_average_hourly_earnings": "CES0500000003",
    }
    FRED_SERIES = {
        "fed_funds": "FEDFUNDS",
        "us_2y": "DGS2",
        "us_10y": "DGS10",
        "us_10y_2y_spread": "T10Y2Y",
        "vix": "VIXCLS",
    }

    BLS_CACHE_TTL_SECONDS = 15 * 60
    FAILED_SOURCE_CACHE_TTL_SECONDS = 60
    ONS_CACHE_TTL_SECONDS = 6 * 60 * 60
    _bls_cache = None
    _ons_cache = None
    _bls_lock = threading.Lock()
    _ons_lock = threading.Lock()

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
            "Accept": "application/json,text/html,text/plain,*/*",
        })

    def get_snapshot(self) -> dict[str, Any]:
        snapshot = {"source_status": {}, "observations": {}, "fetched_at": datetime.now(timezone.utc).isoformat()}
        self._load_bls(snapshot)
        self._load_ons(snapshot)
        self._load_fred(snapshot)
        return snapshot

    def _load_bls(self, snapshot: dict[str, Any]) -> None:
        now = time.monotonic()
        with self._bls_lock:
            if self._bls_cache:
                cached_at, observations, status = self._bls_cache
                ttl = self.BLS_CACHE_TTL_SECONDS if status == "CURRENT" else self.FAILED_SOURCE_CACHE_TTL_SECONDS
                if now - cached_at < ttl:
                    snapshot["observations"].update(observations)
                    snapshot["source_status"]["bls"] = status
                    return
            try:
                observations = self._bls_batch("v1")
                status = "CURRENT" if observations else "UNAVAILABLE"
            except Exception as first_exc:
                logger.warning("BLS v1 batch failed, trying v2 batch: %s", first_exc)
                try:
                    observations = self._bls_batch("v2")
                    status = "CURRENT" if observations else "UNAVAILABLE"
                except Exception as second_exc:
                    logger.warning("BLS macro provider unavailable: %s", second_exc)
                    observations, status = {}, "UNAVAILABLE"
            self._bls_cache = (now, observations, status)
            snapshot["observations"].update(observations)
            snapshot["source_status"]["bls"] = status

    def _bls_batch(self, version: str) -> dict[str, list[dict[str, Any]]]:
        url = self.BLS_V1_URL if version == "v1" else self.BLS_V2_URL
        payload = {"seriesid": list(self.BLS_SERIES.values()), "startyear": "2025", "endyear": "2026"}
        if version == "v2" and os.getenv("BLS_REGISTRATION_KEY", "").strip():
            payload["registrationkey"] = os.getenv("BLS_REGISTRATION_KEY", "").strip()
        response = self.session.post(url, json=payload, timeout=self.timeout_seconds)
        response.raise_for_status()
        body = response.json() or {}
        if body.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError(f"BLS {version} returned {body.get('message') or 'an unsuccessful response'}.")
        reverse = {v: k for k, v in self.BLS_SERIES.items()}
        result = {}
        for series in (body.get("Results") or {}).get("series") or []:
            key = reverse.get(series.get("seriesID"))
            if not key:
                continue
            rows = []
            for item in series.get("data") or []:
                value = self._number(item.get("value"))
                if value is not None:
                    rows.append({"period": item.get("periodName"), "year": item.get("year"), "value": value, "date": self._bls_date(item), "source": "U.S. Bureau of Labor Statistics"})
            if rows:
                result[key] = rows
        return result

    def _load_ons(self, snapshot: dict[str, Any]) -> None:
        now = time.monotonic()
        with self._ons_lock:
            if self._ons_cache and now - self._ons_cache[0] < self.ONS_CACHE_TTL_SECONDS:
                rows, status = self._ons_cache[1], self._ons_cache[2]
                snapshot["observations"]["uk_cpih"] = rows
                snapshot["source_status"]["ons"] = status
                return
            try:
                rows = self._fetch_ons_cpih()
                status = "CURRENT" if rows else "UNAVAILABLE"
            except Exception as exc:
                logger.warning("ONS macro provider failed: %s", exc)
                rows, status = [], "UNAVAILABLE"
            self._ons_cache = (now, rows, status)
            snapshot["observations"]["uk_cpih"] = rows
            snapshot["source_status"]["ons"] = status

    def _fetch_ons_cpih(self) -> list[dict[str, Any]]:
        """Fetch CPIH from the official ONS L522 HTML table; use the beta API only as fallback."""
        try:
            response = self.session.get(self.ONS_L522_DATA_URL, timeout=self.timeout_seconds)
            response.raise_for_status()
            rows = self._parse_l522_html(response.text)
            if rows:
                return rows[-24:]
            raise RuntimeError("ONS L522 page contained no monthly CPIH rows.")
        except Exception as exc:
            logger.warning("ONS L522 HTML endpoint failed, trying dataset API: %s", exc)

        dataset = self.session.get(self.ONS_DATASET_URL, timeout=self.timeout_seconds)
        dataset.raise_for_status()
        body = dataset.json() or {}
        latest = (body.get("links") or {}).get("latest_version") or {}
        href = latest.get("href") if isinstance(latest, dict) else None
        if not href:
            raise RuntimeError("ONS CPIH dataset did not expose latest_version.")
        response = self.session.get(f"{href.rstrip('/')}/observations", params={"time": "*", "geography": "K02000001", "aggregate": "cpih1dim1A0"}, timeout=self.timeout_seconds)
        response.raise_for_status()
        observations = (response.json() or {}).get("observations") or []
        rows = []
        for item in observations:
            value = self._number(item.get("observation"))
            label = self._extract_time(item)
            if value is not None and label:
                rows.append({"date": label, "value": value, "source": "UK Office for National Statistics", "dataset": "CPIH"})
        rows.sort(key=lambda row: self._ons_sort_key(row["date"]))
        if not rows:
            raise RuntimeError("ONS CPIH returned no usable observations.")
        return rows[-24:]

    @staticmethod
    def _parse_l522_html(html: str) -> list[dict[str, Any]]:
        """Parse monthly rows from the official ONS L522 HTML table."""
        rows: list[dict[str, Any]] = []
        # ONS renders rows as: <td>2026 JAN</td><td>140.4</td> ...
        pattern = re.compile(
            r"<td[^>]*>\s*(\d{4})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*</td>\s*"
            r"<td[^>]*>\s*([^<]+?)\s*</td>",
            re.IGNORECASE | re.DOTALL,
        )
        for match in pattern.finditer(html):
            year, month, raw_value = match.groups()
            value = MacroDataProvider._number(unescape(raw_value).replace(",", "").strip())
            if value is None:
                continue
            label = f"{month.title()}-{year[2:]}"
            rows.append({
                "date": label,
                "value": value,
                "source": "UK Office for National Statistics",
                "dataset": "CPIH",
                "series": "L522",
            })
        rows.sort(key=lambda row: MacroDataProvider._ons_sort_key(row["date"]))
        return rows

    @staticmethod
    def _extract_time(item: dict[str, Any]) -> str | None:
        dimensions = item.get("dimensions") or {}
        candidate = dimensions.get("time") if isinstance(dimensions, dict) else None
        if isinstance(candidate, dict):
            candidate = candidate.get("option") or candidate.get("label") or candidate.get("id")
        if isinstance(candidate, str) and re.fullmatch(r"[A-Za-z]{3}-\d{2}", candidate):
            return candidate
        for key in ("time", "date", "period"):
            candidate = item.get(key)
            if isinstance(candidate, str) and re.fullmatch(r"[A-Za-z]{3}-\d{2}", candidate):
                return candidate
        return None

    @staticmethod
    def _ons_sort_key(label: str) -> datetime:
        month, year = label.split("-")
        yy = int(year)
        current = datetime.now(timezone.utc).year
        full_year = 2000 + yy if yy <= current % 100 + 1 else 1900 + yy
        return datetime.strptime(f"{month}-{full_year}", "%b-%Y")

    def _load_fred(self, snapshot: dict[str, Any]) -> None:
        key = os.getenv("FRED_API_KEY", "").strip()
        if not key:
            snapshot["source_status"]["fred"] = "NOT_CONFIGURED"
            return
        try:
            observations = {}
            for name, series_id in self.FRED_SERIES.items():
                response = self.session.get(self.FRED_URL, params={"series_id": series_id, "api_key": key, "file_type": "json", "sort_order": "asc", "limit": 24}, timeout=self.timeout_seconds)
                response.raise_for_status()
                rows = []
                for item in (response.json() or {}).get("observations") or []:
                    value = self._number(item.get("value"))
                    if value is not None:
                        rows.append({"date": item.get("date"), "value": value, "source": "FRED"})
                observations[name] = rows
            snapshot["observations"].update(observations)
            snapshot["source_status"]["fred"] = "CURRENT"
        except Exception as exc:
            logger.warning("FRED macro provider failed: %s", exc)
            snapshot["source_status"]["fred"] = "UNAVAILABLE"

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            if value in (None, "", "."):
                return None
            number = float(value)
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _bls_date(item: dict[str, Any]) -> str:
        return f"{item.get('year') or ''}-{item.get('period') or ''}"
