from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from providers.macro_data_provider import MacroDataProvider
from providers.online_market_data_provider import YahooMarketDataProvider


class ResilientMacroDataProvider(MacroDataProvider):
    """Macro provider with non-FRED fallbacks for local environments."""

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        super().__init__(timeout_seconds=timeout_seconds)
        self.market = YahooMarketDataProvider(timeout_seconds=timeout_seconds)

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

        # FRED's API requires an API key, and the keyless graph endpoint can be
        # unreachable from some local networks. Do not keep retrying it on every
        # request. Use the existing official/online providers instead.
        self._fallback_policy_rate(observations)
        self._fallback_market_series(observations)

        if any(observations.get(key) for key in ("fed_funds", "us_2y", "us_10y", "vix")):
            snapshot["source_status"]["fred"] = "CURRENT"
        else:
            snapshot["source_status"]["fred"] = "NOT_CONFIGURED"
        return snapshot

    def _fallback_policy_rate(self, observations: dict[str, Any]) -> None:
        if observations.get("fed_funds"):
            return
        # MacroDataService separately attaches the official FOMC policy snapshot;
        # this fallback intentionally does not invent a rate. The UI can still use
        # policy.fed when available.

    def _fallback_market_series(self, observations: dict[str, Any]) -> None:
        mappings = {
            "us_10y": "US10Y",
            "vix": "VIX",
        }
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

        # US 2Y is not exposed by the existing Yahoo symbol map. Leave it
        # unavailable rather than substituting an unrelated instrument.
        # The 2s10s spread is likewise left unavailable without both inputs.
        if observations.get("us_2y") and observations.get("us_10y"):
            two = observations["us_2y"][-1]["value"]
            ten = observations["us_10y"][-1]["value"]
            observations["us_10y_2y_spread"] = self._observation(
                float(ten) - float(two),
                "Derived from Yahoo Finance",
                "percentage_points",
            )
