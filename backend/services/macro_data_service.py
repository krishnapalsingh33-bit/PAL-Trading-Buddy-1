from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

from providers.macro_data_provider import MacroDataProvider
from providers.official_policy_provider import OfficialPolicyProvider
from providers.public_fred_provider import PublicFredProvider


class MacroDataService:
    """Cached macro observations shared by every PAL V2 macro surface."""

    def __init__(self, ttl_seconds: int = 300, policy_ttl_seconds: int = 900) -> None:
        self.provider = MacroDataProvider()
        self.public_fred_provider = PublicFredProvider()
        self.policy_provider = OfficialPolicyProvider()
        self.ttl = timedelta(seconds=ttl_seconds)
        self.policy_ttl = timedelta(seconds=policy_ttl_seconds)
        self._cache: tuple[datetime, dict] | None = None
        self._policy_cache: tuple[datetime, dict] | None = None
        self._lock = Lock()

    def get_snapshot(self, force_refresh: bool = False) -> dict:
        with self._lock:
            now = datetime.now(timezone.utc)
            if not force_refresh and self._cache is not None:
                stored_at, snapshot = self._cache
                if now - stored_at <= self.ttl:
                    return snapshot

        snapshot = self.provider.get_snapshot()
        self._fill_public_fred_fallback(snapshot)

        try:
            snapshot["policy"] = self._get_policy(force_refresh=force_refresh)
        except Exception as exc:
            snapshot["policy"] = {
                "fetched_at": None,
                "fed": {
                    "status": "UNAVAILABLE",
                    "currency": "USD",
                    "source": "Federal Reserve",
                    "reason": str(exc),
                },
                "boe": {
                    "status": "UNAVAILABLE",
                    "currency": "GBP",
                    "source": "Bank of England",
                    "reason": str(exc),
                },
            }

        with self._lock:
            self._cache = (datetime.now(timezone.utc), snapshot)
        return snapshot

    def _fill_public_fred_fallback(self, snapshot: dict) -> None:
        """Fill missing FRED series from public CSV without requiring an API key."""
        observations = snapshot.setdefault("observations", {})
        missing = {
            key for key in self.public_fred_provider.SERIES
            if not observations.get(key)
        }
        if not missing:
            snapshot.setdefault("source_status", {})["fred"] = "CURRENT"
            return

        try:
            fallback = self.public_fred_provider.get_snapshot()
            for key in missing:
                rows = fallback.get(key)
                if rows:
                    observations[key] = rows
            snapshot.setdefault("source_status", {})["fred"] = (
                "CURRENT"
                if any(observations.get(key) for key in self.public_fred_provider.SERIES)
                else "UNAVAILABLE"
            )
        except Exception:
            snapshot.setdefault("source_status", {})["fred"] = "UNAVAILABLE"

    def _get_policy(self, force_refresh: bool = False) -> dict:
        with self._lock:
            now = datetime.now(timezone.utc)
            if not force_refresh and self._policy_cache is not None:
                stored_at, snapshot = self._policy_cache
                if now - stored_at <= self.policy_ttl:
                    return snapshot

        snapshot = self.policy_provider.get_snapshot()
        with self._lock:
            self._policy_cache = (datetime.now(timezone.utc), snapshot)
        return snapshot

    def clear_cache(self) -> None:
        with self._lock:
            self._cache = None
            self._policy_cache = None
