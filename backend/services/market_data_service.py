from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

from models.market_quote import MarketQuote
from providers.provider_factory import ProviderFactory


class MarketDataService:
    """Cached online market snapshots plus provider-backed intraday momentum."""

    SYMBOLS = ("DXY", "GBPUSD", "XAUUSD", "USOIL", "US10Y", "US500")

    def __init__(self, ttl_seconds: int = 15) -> None:
        self.provider = ProviderFactory.get_provider()
        self.ttl = timedelta(seconds=ttl_seconds)
        self._cache: dict[str, tuple[datetime, MarketQuote]] = {}
        self._right_now: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    @staticmethod
    def _intraday_market_closed() -> bool:
        now = datetime.now(timezone.utc)
        # Main FX/DXY spot market is closed from Friday 21:00 UTC through Sunday 21:00 UTC.
        if now.weekday() == 5:
            return True
        if now.weekday() == 6 and now.hour < 21:
            return True
        if now.weekday() == 4 and now.hour >= 21:
            return True
        return False

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

    def _get_right_now(self, symbol: str) -> dict[str, Any]:
        getter = getattr(self.provider, "get_intraday_momentum", None)
        if not callable(getter):
            return {"status": "WARMING_UP", "momentum_percent": None, "price": None, "points": []}
        try:
            momentum, price, points = getter(symbol)
            points = list(points or [])
            if momentum is not None:
                status = "CURRENT"
            elif self._intraday_market_closed():
                status = "MARKET_CLOSED"
            else:
                status = "WARMING_UP"
            with self._lock:
                previous = self._right_now.get(symbol, {})
                self._right_now[symbol] = {
                    "status": status,
                    "momentum_percent": round(float(momentum), 4) if momentum is not None else None,
                    "price": price,
                    "points": points,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "previous_momentum": previous.get("momentum_percent"),
                }
                return dict(self._right_now[symbol])
        except Exception:
            with self._lock:
                previous = self._right_now.get(symbol)
            if previous:
                return previous
            return {
                "status": "MARKET_CLOSED" if self._intraday_market_closed() else "WARMING_UP",
                "momentum_percent": None,
                "price": None,
                "points": [],
            }

    def get_market_data(self, symbol: str, force_refresh: bool = False) -> MarketQuote:
        normalized = symbol.upper()
        if not force_refresh:
            cached = self._cached(normalized)
            if cached is not None:
                return cached

        quote = self.provider.get_quote(normalized)
        if quote.price is not None:
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
                    "reason": quote.reason or "Online market provider returned no current quote.",
                }
            )
        return quote

    def get_snapshot(self, force_refresh: bool = False) -> dict[str, dict]:
        snapshot: dict[str, dict] = {}
        for symbol in self.SYMBOLS:
            quote = self.get_market_data(symbol, force_refresh=force_refresh)
            data = quote.to_dict()
            if symbol in {"DXY", "GBPUSD"}:
                right_now = self._get_right_now(symbol)
            else:
                right_now = {"status": "NOT_TRACKED", "momentum_percent": None, "price": quote.price, "points": []}
            data["right_now_momentum_percent"] = right_now.get("momentum_percent")
            data["right_now_status"] = right_now.get("status")
            data["right_now_price"] = right_now.get("price") or quote.price
            data["right_now_points"] = right_now.get("points", [])
            data["right_now_previous_momentum"] = right_now.get("previous_momentum")
            snapshot[symbol] = data
        return snapshot

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()
            self._right_now.clear()
