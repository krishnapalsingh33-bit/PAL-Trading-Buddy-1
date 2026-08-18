from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

from providers.macro_data_provider import MacroDataProvider


class MacroDataService:
    """Cached macro observations shared by every PAL V2 macro surface."""

    def __init__(self, ttl_seconds: int = 300) -> None:
        self.provider = MacroDataProvider()
        self.ttl = timedelta(seconds=ttl_seconds)
        self._cache: tuple[datetime, dict] | None = None
        self._lock = Lock()

    def get_snapshot(self, force_refresh: bool = False) -> dict:
        with self._lock:
            if not force_refresh and self._cache is not None:
                stored_at, snapshot = self._cache
                if datetime.now(timezone.utc) - stored_at <= self.ttl:
                    return snapshot

        snapshot = self.provider.get_snapshot()
        with self._lock:
            self._cache = (datetime.now(timezone.utc), snapshot)
        return snapshot

    def clear_cache(self) -> None:
        with self._lock:
            self._cache = None
