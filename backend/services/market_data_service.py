from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

from models.market_quote import MarketQuote
from providers.provider_factory import ProviderFactory


class MarketDataService:
    """Cached cloud-safe market snapshot service."""

    SYMBOLS = ("DXY", "GBPUSD", "XAUUSD", "USOIL", "US10Y", "US500")

    def __init__(self, ttl_seconds: int = 15) -> None:
        self.provider = ProviderFactory.get_provider()
        self.ttl = timedelta(seconds=ttl_seconds)
        self._cache: dict[str, tuple[datetime, MarketQuote]] = {}
        self._lock = Lock()

    def _cached(self, symbol: str) -> MarketQuote | None:
        with self._lock:
            entry = self._cache.get(symbol)
            if entry is None:
                return None
            stored_at, quote = entry
            if datetime.now(timezone.utc) - stored_at <= self.ttl:
                return quote
            return None

    def _set_cache(self, symbol: str, quote: MarketQuote) -> None:
        with self._lock:
            self._cache[symbol] = (datetime.now(timezone.utc), quote)

    def get_market_data(self, symbol: str, force_refresh: bool = False) -> MarketQuote:
        normalized = symbol.upper()
        if not force_refresh:
            cached = self._cached(normalized)
            if cached is not None:
                return cached

        quote = self.provider.get_quote(normalized)
        if quote.status == "CURRENT":
            self._set_cache(normalized, quote)
            return quote

        with self._lock:
            previous = self._cache.get(normalized)
        if previous is not None:
            _, stale_quote = previous
            return MarketQuote(
                **{
                    **stale_quote.to_dict(),
                    "status": "STALE",
                    "reason": quote.reason or "Provider temporarily unavailable.",
                }
            )
        return quote

    def get_snapshot(self, force_refresh: bool = False) -> dict[str, dict]:
        return {
            symbol: self.get_market_data(symbol, force_refresh=force_refresh).to_dict()
            for symbol in self.SYMBOLS
        }

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()
