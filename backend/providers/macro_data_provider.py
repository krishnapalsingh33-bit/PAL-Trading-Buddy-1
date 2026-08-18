from __future__ import annotations

import csv
import io
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)


class MacroDataProvider:
    """Fetch public macro observations without making PAL depend on one source."""

    BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
    ONS_DATASET_URL = "https://api.beta.ons.gov.uk/v1/datasets/cpih01"
    ONS_OBSERVATIONS_URL = (
        "https://api.beta.ons.gov.uk/v1/datasets/cpih01/editions/time-series/versions/{version}/observations"
    )

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
        self.session.headers.update(
            {
                "User-Agent": "PAL-Trading-Buddy/2.2 (macro intelligence)",
                "Accept": "application/json,text/csv",
                "Content-Type": "application/json",
            }
        )

    def get_snapshot(self) -> dict[str, Any]:
        snapshot: dict[str, Any] = {
            "source_status": {},
            "observations": {},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
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
                observations = self._bls_post()
                status = "CURRENT" if observations else "UNAVAILABLE"
            except Exception as post_exc:
                logger.warning("BLS bulk request failed, trying public single-series fallback: %s", post_exc)
                try:
                    observations = self._bls_get_latest()
                    status = "CURRENT" if observations else "UNAVAILABLE"
                except Exception as get_exc:
                    logger.warning("BLS macro provider unavailable: %s", get_exc)
                    observations = {}
                    status = "UNAVAILABLE"

            self._bls_cache = (now, observations, status)
            snapshot["observations"].update(observations)
            snapshot["source_status"]["bls"] = status

    def _bls_post(self) -> dict[str, list[dict[str, Any]]]:
        response = self.session.post(
            self.BLS_URL,
            json={"seriesid": list(self.BLS_SERIES.values()), "latest": "true"},
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json() or {}
        if payload.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError("BLS returned an unsuccessful response.")
        return self._parse_bls_series(payload.get("Results", {}).get("series") or [])

    def _bls_get_latest(self) -> dict[str, list[dict[str, Any]]]:
        reverse_map = {value: key for key, value in self.BLS_SERIES.items()}
        observations: dict[str, list[dict[str, Any]]] = {}
        for series_id, key in reverse_map.items():
            response = self.session.get(
                f"{self.BLS_URL}{series_id}",
                params={"latest": "true"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json() or {}
            if payload.get("status") != "REQUEST_SUCCEEDED":
                raise RuntimeError(f"BLS returned an unsuccessful response for {series_id}.")
            parsed = self._parse_bls_series(payload.get("Results", {}).get("series") or [])
            observations.update({key: rows for key, rows in parsed.items()})
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
            rows: list[dict[str, Any]] = []
            for item in series.get("data") or []:
                if not isinstance(item, dict):
                    continue
                value = self._number(item.get("value"))
                if value is None:
                    continue
                rows.append(
                    {
                        "period": item.get("periodName"),
                        "year": item.get("year"),
                        "value": value,
                        "date": self._bls_date(item),
                        "source": "U.S. Bureau of Labor Statistics",
                    }
                )
            if rows:
                observations[key] = rows
        return observations

    def _load_fred(self, snapshot: dict[str, Any]) -> None:
        api_key = os.getenv("FRED_API_KEY", "").strip()
        if not api_key:
            snapshot["source_status"]["fred"] = "NOT_CONFIGURED"
            return
        try:
            observations: dict[str, list[dict[str, Any]]] = {}
            for key, series_id in self.FRED_SERIES.items():
                response = self.session.get(
                    self.FRED_URL,
                    params={
                        "series_id": series_id,
                        "api_key": api_key,
                        "file_type": "json",
                        "sort_order": "asc",
                        "limit": 24,
                    },
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json() or {}
                rows = []
                for item in payload.get("observations") or []:
                    value = self._number(item.get("value"))
                    if value is None:
                        continue
                    rows.append({"date": item.get("date"), "value": value, "source": "FRED"})
                observations[key] = rows
            snapshot["observations"].update(observations)
            snapshot["source_status"]["fred"] = "CURRENT"
        except Exception as exc:
            logger.warning("FRED macro provider failed: %s", exc)
            snapshot["source_status"]["fred"] = "UNAVAILABLE"

    def _load_ons(self, snapshot: dict[str, Any]) -> None:
        try:
            metadata = self.session.get(self.ONS_DATASET_URL, timeout=self.timeout_seconds)
            metadata.raise_for_status()
            metadata_payload = metadata.json() or {}
            links = metadata_payload.get("links") or {}
            latest = links.get("latest_version") or {}
            version = latest.get("id") if isinstance(latest, dict) else None
            if not version:
                raise RuntimeError("ONS did not return the latest CPIH version.")

            response = self.session.get(
                self.ONS_OBSERVATIONS_URL.format(version=version),
                params={"time": "*", "geography": "K02000001", "aggregate": "cpih1dim1A0"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json() or {}
            raw = payload.get("observations") or []
            observations = raw if isinstance(raw, list) else []
            rows: list[dict[str, Any]] = []
            for item in observations:
                if not isinstance(item, dict):
                    continue
                value = self._number(item.get("observation"))
                if value is None:
                    continue
                dimensions = item.get("dimensions") or {}
                time_dimension = dimensions.get("time") or {}
                option = time_dimension.get("option") or {}
                rows.append(
                    {
                        "date": option.get("id"),
                        "value": value,
                        "source": "UK Office for National Statistics",
                        "dataset": "CPIH",
                    }
                )
            snapshot["observations"]["uk_cpih"] = rows[-24:]
            snapshot["source_status"]["ons"] = "CURRENT" if rows else "UNAVAILABLE"
        except Exception as exc:
            logger.warning("ONS macro provider failed: %s", exc)
            snapshot["source_status"]["ons"] = "UNAVAILABLE"

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
