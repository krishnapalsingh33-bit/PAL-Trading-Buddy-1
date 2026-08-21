from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

from models.market_quote import MarketQuote
from providers.provider_factory import ProviderFactory


class MarketDataService:
    """Cached online market snapshot service with a short-term momentum observation."""

    SYMBOLS = ("DXY", "GBPUSD", "XAUUSD", "USOIL", "US10Y", "US500")

    def __init__(self, ttl_seconds: int = 15) -> None:
        self.provider = ProviderFactory.get_provider()
        self.ttl = timedelta(seconds=ttl_seconds)
        self._cache: dict[str, tuple[datetime, MarketQuote]] = {}
        self._recent: dict[str, list[tuple[datetime, float]]] = {}
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
            price = quote.price
            if price is not None:
                now = datetime.now(timezone.utc)
                history = self._recent.setdefault(symbol, [])
                history.append((now, float(price)))
                cutoff = now - timedelta(minutes=3)
                self._recent[symbol] = [(stamp, value) for stamp, value in history if stamp >= cutoff][-40:]

    def _short_term_momentum(self, symbol: str) -> float | None:
        """Return the observed price change over roughly the last 60 seconds.

        This is intentionally not a 5m/15m/30m/1h timeframe calculation. It is
        a live-stream observation used only for the dashboard's RIGHT NOW bias.
        """
        with self._lock:
            history = list(self._recent.get(symbol, []))
        if len(history) < 2:
            return None
        now, current = history[-1]
        target = now - timedelta(seconds=45)
        baseline = next(((stamp, value) for stamp, value in history if stamp <= target), history[0])
        if baseline[1] == 0:
            return None
        return (current - baseline[1]) / baseline[1] * 100.0

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
        snapshot: dict[str, dict] = {}
        for symbol in self.SYMBOLS:
            quote = self.get_market_data(symbol, force_refresh=force_refresh)
            data = quote.to_dict()
            data["right_now_momentum_percent"] = self._short_term_momentum(symbol)
            snapshot[symbol] = data
        return snapshot

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()
            self._recent.clear()
