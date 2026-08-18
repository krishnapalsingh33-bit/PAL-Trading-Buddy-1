from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from providers.macro_data_provider import MacroDataProvider
from providers.online_market_data_provider import YahooMarketDataProvider
from providers.treasury_yield_provider import TreasuryYieldProvider


class ResilientMacroDataProvider(MacroDataProvider):
    """Macro provider that does not block on the optional FRED API."""

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        super().__init__(timeout_seconds=timeout_seconds)
        self.market = YahooMarketDataProvider(timeout_seconds=timeout_seconds)
        self.treasury = TreasuryYieldProvider(timeout_seconds=timeout_seconds)

    @staticmethod
    def _observation(value: float, source: str, unit: str = "value") -> list[dict[str, Any]]:
        return [{
            "date": datetime.now(timezone.utc).date().isoformat(),
            "value": value,
            "source": source,
            "unit": unit,
        }]

    def get_snapshot(self) -> dict[str, Any]:
        # Deliberately do not call MacroDataProvider.get_snapshot(): that method
        # calls FRED after BLS/ONS and can block the entire Macro View when the
        # user's network cannot reach fred.stlouisfed.org. BLS and ONS remain
        # available through their existing cached provider methods.
        snapshot: dict[str, Any] = {
            "source_status": {},
            "observations": {},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        self._load_bls(snapshot)
        self._load_ons(snapshot)

        observations = snapshot["observations"]
        self._fallback_treasury(observations)
        self._fallback_market_series(observations)

        # FRED is optional. Treasury, Federal Reserve policy, and Yahoo/CBOE
        # are the active sources used by the resilient provider.
        snapshot["source_status"]["fred"] = "NOT_CONFIGURED"
        snapshot["source_status"]["treasury"] = "CURRENT" if observations.get("us_2y") or observations.get("us_10y") else "UNAVAILABLE"
        snapshot["source_status"]["market"] = "CURRENT" if observations.get("vix") else "UNAVAILABLE"
        return snapshot

    def _fallback_treasury(self, observations: dict[str, Any]) -> None:
        needed = {key for key in ("us_2y", "us_10y") if not observations.get(key)}
        if not needed:
            return
        try:
            rows = self.treasury.get_snapshot()
            for key in needed:
                if rows.get(key):
                    observations[key] = rows[key]
        except Exception:
            return

    def _fallback_market_series(self, observations: dict[str, Any]) -> None:
        if not observations.get("vix"):
            try:
                quote = self.market.get_quote("VIX")
                if quote.status in {"CURRENT", "RECENT", "STALE"} and quote.price is not None:
                    observations["vix"] = self._observation(float(quote.price), quote.source or "Yahoo Finance")
            except Exception:
                pass

        if not observations.get("us_10y"):
            try:
                quote = self.market.get_quote("US10Y")
                if quote.status in {"CURRENT", "RECENT", "STALE"} and quote.price is not None:
                    observations["us_10y"] = self._observation(float(quote.price), quote.source or "Yahoo Finance", getattr(quote, "unit", "yield_percent"))
            except Exception:
                pass

        if observations.get("us_2y") and observations.get("us_10y"):
            two = float(observations["us_2y"][-1]["value"])
            ten = float(observations["us_10y"][-1]["value"])
            observations["us_10y_2y_spread"] = self._observation(ten - two, "Derived from U.S. Treasury", "percentage_points")
