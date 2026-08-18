from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from providers.macro_data_provider import MacroDataProvider
from providers.online_market_data_provider import YahooMarketDataProvider
from providers.treasury_yield_provider import TreasuryYieldProvider


class ResilientMacroDataProvider(MacroDataProvider):
    """Macro provider with official Treasury and online-market fallbacks."""

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
        snapshot = super().get_snapshot()
        observations = snapshot.setdefault("observations", {})

        # FRED requires an API key and may be unreachable from a local network.
        # Do not repeatedly block Macro View on that endpoint.
        self._fallback_treasury(observations)
        self._fallback_market_series(observations)

        # fed_funds is populated by MacroDataService from the official FOMC policy
        # snapshot, so this source status describes the optional FRED feed only.
        snapshot["source_status"]["fred"] = "CURRENT" if any(
            observations.get(key) for key in ("fed_funds", "us_2y", "us_10y", "vix")
        ) else "NOT_CONFIGURED"
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
        mappings = {"us_10y": "US10Y", "vix": "VIX"}
        for key, symbol in mappings.items():
            if observations.get(key):
                continue
            try:
                quote = self.market.get_quote(symbol)
                if quote.status in {"CURRENT", "RECENT", "STALE"} and quote.price is not None:
                    observations[key] = self._observation(
                        float(quote.price),
                        "Yahoo Finance",
                        getattr(quote, "unit", "value"),
                    )
            except Exception:
                continue

        if observations.get("us_2y") and observations.get("us_10y"):
            two = observations["us_2y"][-1]["value"]
            ten = observations["us_10y"][-1]["value"]
            observations["us_10y_2y_spread"] = self._observation(
                float(ten) - float(two),
                "Derived from U.S. Treasury",
                "percentage_points",
            )
