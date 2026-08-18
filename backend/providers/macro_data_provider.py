from __future__ import annotations

import csv
import io
import logging
import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)


class MacroDataProvider:
    """Fetch public macro observations without making PAL depend on one source."""

    BLS_V1_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
    BLS_V2_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
    ONS_BASE_URL = "https://api.beta.ons.gov.uk/v1"
    ONS_DATASET_URL = f"{ONS_BASE_URL}/datasets/cpih01"

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
    _bls_cache: tuple[float, dict[str, list[dict[str, Any]]], str] | None = None
    _ons_cache: tuple[float, list[dict[str, Any]], str] | None = None
    _bls_lock = threading.Lock()
    _ons_lock = threading.Lock()

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
            "Accept": "application/json,text/plain,*/*",
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
            cached = self._bls_cache
            if cached:
                cached_at, observations, status = cached
                ttl = self.BLS_CACHE_TTL_SECONDS if status == "CURRENT" else self.FAILED_SOURCE_CACHE_TTL_SECONDS
                if now - cached_at < ttl:
                    snapshot["observations"].update(observations)
                    snapshot["source_status"]["bls"] = status
                    return
            try:
                observations = self._bls_batch("v1")
                status = "CURRENT" if observations else "UNAVAILABLE"
            except Exception as v1_exc:
                logger.warning("BLS v1 batch failed, trying v2 batch: %s", v1_exc)
                try:
                    observations = self._bls_batch("v2")
                    status = "CURRENT" if observations else "UNAVAILABLE"
                except Exception as v2_exc:
                    logger.warning("BLS macro provider unavailable: %s", v2_exc)
                    observations, status = {}, "UNAVAILABLE"
            self._bls_cache = (now, observations, status)
            snapshot["observations"].update(observations)
            snapshot["source_status"]["bls"] = status

    def _bls_batch(self, version: str) -> dict[str, list[dict[str, Any]]]:
        base = self.BLS_V1_URL if version == "v1" else self.BLS_V2_URL
        payload: dict[str, Any] = {"seriesid": list(self.BLS_SERIES.values()), "startyear": "2025", "endyear": "2026"}
        if version == "v2":
            key = os.getenv("BLS_REGISTRATION_KEY", "").strip()
            if key:
                payload["registrationkey"] = key
        response = self.session.post(base, json=payload, timeout=self.timeout_seconds)
        response.raise_for_status()
        body = response.json() or {}
        if body.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError(f"BLS {version} returned {body.get('message') or 'an unsuccessful response'}.")
        return self._parse_bls_series((body.get("Results") or {}).get("series") or [])

    def _parse_bls_series(self, series_list: list[Any]) -> dict[str, list[dict[str, Any]]]:
        reverse_map = {value: key for key, value in self.BLS_SERIES.items()}
        observations: dict[str, list[dict[str, Any]]] = {}
        for series in series_list:
            if not isinstance(series, dict):
                continue
            key = reverse_map.get(series.get("seriesID"))
            if not key:
                continue
            rows = []
            for item in series.get("data") or []:
                value = self._number(item.get("value")) if isinstance(item, dict) else None
                if value is not None:
                    rows.append({"period": item.get("periodName"), "year": item.get("year"), "value": value, "date": self._bls_date(item), "source": "U.S. Bureau of Labor Statistics"})
            if rows:
                observations[key] = rows
        return observations

    def _load_ons(self, snapshot: dict[str, Any]) -> None:
        now = time.monotonic()
        with self._ons_lock:
            cached = self._ons_cache
            if cached and now - cached[0] < self.ONS_CACHE_TTL_SECONDS:
                rows, status = cached[1], cached[2]
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
        """Fetch CPIH from the latest ONS release, with API observation and CSV fallbacks."""
        dataset = self.session.get(self.ONS_DATASET_URL, timeout=self.timeout_seconds)
        dataset.raise_for_status()
        body = dataset.json() or {}
        latest = (body.get("links") or {}).get("latest_version") or {}
        latest_href = latest.get("href") if isinstance(latest, dict) else None
        if not latest_href:
            raise RuntimeError("ONS CPIH dataset did not expose a latest_version link.")
        match = re.search(r"/versions/(\d+)$", latest_href.rstrip("/"))
        if not match:
            raise RuntimeError(f"Unable to determine ONS CPIH version from {latest_href!r}.")
        version = int(match.group(1))

        try:
            return self._fetch_ons_observations(latest_href.rstrip("/"), version)
        except Exception as observation_exc:
            logger.warning("ONS observation API failed, trying release CSV: %s", observation_exc)
            return self._fetch_ons_csv(latest_href.rstrip("/"), version)

    def _fetch_ons_observations(self, latest_href: str, version: int) -> list[dict[str, Any]]:
        options_url = f"{latest_href}/dimensions/time/options"
        response = self.session.get(options_url, params={"limit": 1000}, timeout=self.timeout_seconds)
        response.raise_for_status()
        items = (response.json() or {}).get("items") or []
        dated: list[tuple[datetime, str]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            label = item.get("label") or item.get("option") or item.get("id")
            if isinstance(label, str) and re.fullmatch(r"[A-Za-z]{3}-\d{2}", label.strip()):
                try:
                    dated.append((self._ons_month_key(label.strip()), label.strip()))
                except ValueError:
                    pass
        if not dated:
            raise RuntimeError(f"ONS CPIH version {version} returned no usable time options.")
        labels = [label for _, label in sorted(dated)[-24:]]
        url = f"{latest_href}/observations"
        rows = []
        for label in labels:
            r = self.session.get(url, params={"time": label, "geography": "K02000001", "aggregate": "cpih1dim1A0"}, timeout=self.timeout_seconds)
            r.raise_for_status()
            obs = (r.json() or {}).get("observations") or []
            if obs:
                value = self._number(obs[0].get("observation"))
                if value is not None:
                    rows.append({"date": label, "value": value, "source": "UK Office for National Statistics", "dataset": "CPIH", "version": version})
        rows.sort(key=lambda row: self._ons_month_key(row["date"]))
        if not rows:
            raise RuntimeError("ONS observation API returned no CPIH values.")
        return rows

    def _fetch_ons_csv(self, latest_href: str, version: int) -> list[dict[str, Any]]:
        version_response = self.session.get(latest_href, timeout=self.timeout_seconds)
        version_response.raise_for_status()
        body = version_response.json() or {}
        downloads = body.get("downloads") or {}
        csv_info = downloads.get("csv") or {}
        csv_url = csv_info.get("href") if isinstance(csv_info, dict) else None
        if not csv_url:
            raise RuntimeError("ONS CPIH latest version did not expose a CSV download link.")
        response = self.session.get(csv_url, timeout=max(self.timeout_seconds, 20.0))
        response.raise_for_status()
        text = response.text
        if not text:
            raise RuntimeError("ONS CPIH CSV download was empty.")
        reader = csv.DictReader(io.StringIO(text))
        rows = []
        for item in reader:
            if not isinstance(item, dict):
                continue
            normal = {str(k).strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in item.items() if k is not None}
            time_label = normal.get("time") or normal.get("date") or normal.get("period")
            geography = normal.get("geography") or normal.get("geography code")
            aggregate = normal.get("aggregate") or normal.get("aggregate code")
            value_raw = normal.get("value") or normal.get("observation")
            if not time_label or not re.fullmatch(r"[A-Za-z]{3}-\d{2}", str(time_label)):
                continue
            if geography and geography != "K02000001":
                continue
            if aggregate and aggregate != "cpih1dim1A0":
                continue
            value = self._number(value_raw)
            if value is None:
                continue
            rows.append({"date": str(time_label), "value": value, "source": "UK Office for National Statistics", "dataset": "CPIH", "version": version})
        rows.sort(key=lambda row: self._ons_month_key(row["date"]))
        rows = rows[-24:]
        if not rows:
            raise RuntimeError("ONS CPIH CSV contained no matching CPIH rows.")
        return rows

    @staticmethod
    def _ons_month_key(label: str) -> datetime:
        month, year = label.split("-")
        two_digit_year = int(year)
        current_year = datetime.now(timezone.utc).year
        century = 2000 if two_digit_year <= (current_year % 100 + 1) else 1900
        return datetime.strptime(f"{month}-{century + two_digit_year}", "%b-%Y")

    def _load_fred(self, snapshot: dict[str, Any]) -> None:
        api_key = os.getenv("FRED_API_KEY", "").strip()
        if not api_key:
            snapshot["source_status"]["fred"] = "NOT_CONFIGURED"
            return
        try:
            observations = {}
            for key, series_id in self.FRED_SERIES.items():
                response = self.session.get(self.FRED_URL, params={"series_id": series_id, "api_key": api_key, "file_type": "json", "sort_order": "asc", "limit": 24}, timeout=self.timeout_seconds)
                response.raise_for_status()
                rows = []
                for item in (response.json() or {}).get("observations") or []:
                    value = self._number(item.get("value"))
                    if value is not None:
                        rows.append({"date": item.get("date"), "value": value, "source": "FRED"})
                observations[key] = rows
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