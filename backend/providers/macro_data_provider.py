from __future__ import annotations

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

    BLS_V2_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    BLS_V1_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
    FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
    ONS_DATASET_URL = "https://api.beta.ons.gov.uk/v1/datasets/cpih01"
    ONS_OBSERVATIONS_URL = "https://api.beta.ons.gov.uk/v1/datasets/cpih01/editions/time-series/versions/{version}/observations"

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
    _bls_cache: tuple[float, dict[str, list[dict[str, Any]]], str] | None = None
    _bls_lock = threading.Lock()

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
            "Accept": "application/json,text/csv",
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
                observations = self._bls_get("v2")
                status = "CURRENT" if observations else "UNAVAILABLE"
            except Exception as v2_exc:
                logger.warning("BLS v2 failed, trying v1: %s", v2_exc)
                try:
                    observations = self._bls_get("v1")
                    status = "CURRENT" if observations else "UNAVAILABLE"
                except Exception as v1_exc:
                    logger.warning("BLS macro provider unavailable: %s", v1_exc)
                    observations = {}
                    status = "UNAVAILABLE"
            self._bls_cache = (now, observations, status)
            snapshot["observations"].update(observations)
            snapshot["source_status"]["bls"] = status

    def _bls_get(self, version: str) -> dict[str, list[dict[str, Any]]]:
        base = self.BLS_V2_URL if version == "v2" else self.BLS_V1_URL
        reverse_map = {value: key for key, value in self.BLS_SERIES.items()}
        observations: dict[str, list[dict[str, Any]]] = {}
        for series_id, key in reverse_map.items():
            response = self.session.get(
                f"{base}{series_id}",
                params={"startyear": "2025", "endyear": "2026"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json() or {}
            if payload.get("status") != "REQUEST_SUCCEEDED":
                message = payload.get("message") or []
                raise RuntimeError(f"BLS {version} returned {message or 'an unsuccessful response'} for {series_id}.")
            results = payload.get("Results") or {}
            series = results.get("series") if isinstance(results, dict) else None
            parsed = self._parse_bls_series(series or [])
            if key in parsed:
                observations[key] = parsed[key]
        return observations

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
                if not isinstance(item, dict):
                    continue
                value = self._number(item.get("value"))
                if value is None:
                    continue
                rows.append({"period": item.get("periodName"), "year": item.get("year"), "value": value, "date": self._bls_date(item), "source": "U.S. Bureau of Labor Statistics"})
            if rows:
                observations[key] = rows
        return observations

    def _load_ons(self, snapshot: dict[str, Any]) -> None:
        try:
            metadata = self.session.get(self.ONS_DATASET_URL, timeout=self.timeout_seconds)
            metadata.raise_for_status()
            payload = metadata.json() or {}
            latest = (payload.get("links") or {}).get("latest_version")
            version = None
            if isinstance(latest, dict):
                version = latest.get("id")
                href = latest.get("href") or ""
                if not version:
                    match = re.search(r"/versions/(\d+)", href)
                    version = match.group(1) if match else None
            elif isinstance(latest, str):
                match = re.search(r"/versions/(\d+)", latest)
                version = match.group(1) if match else latest
            if not version:
                version = "67"
            response = self.session.get(
                self.ONS_OBSERVATIONS_URL.format(version=version),
                params={"time": "*", "geography": "K02000001", "aggregate": "cpih1dim1A0"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            body = response.json() or {}
            raw = body.get("observations") or []
            # ONS returns dimensions once at the response level, not on each observation.
            dimensions = body.get("dimensions") or {}
            time_dimension = dimensions.get("time") or {}
            time_option = time_dimension.get("option") if isinstance(time_dimension, dict) else None
            date = None
            if isinstance(time_option, dict):
                date = time_option.get("id") or time_option.get("label")
            rows = []
            for item in raw if isinstance(raw, list) else []:
                if not isinstance(item, dict):
                    continue
                value = self._number(item.get("observation"))
                if value is not None:
                    rows.append({"date": date, "value": value, "source": "UK Office for National Statistics", "dataset": "CPIH"})
            snapshot["observations"]["uk_cpih"] = rows[-24:]
            snapshot["source_status"]["ons"] = "CURRENT" if rows else "UNAVAILABLE"
        except Exception as exc:
            logger.warning("ONS macro provider failed: %s", exc)
            snapshot["source_status"]["ons"] = "UNAVAILABLE"

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
