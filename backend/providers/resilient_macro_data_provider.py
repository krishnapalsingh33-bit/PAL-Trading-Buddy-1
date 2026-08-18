from __future__ import annotations

from typing import Any

from providers.macro_data_provider import MacroDataProvider
from providers.public_fred_provider import PublicFredProvider


class ResilientMacroDataProvider(MacroDataProvider):
    """Macro provider with a keyless public FRED fallback."""

    def __init__(self, timeout_seconds: float = 8.0) -> None:
        super().__init__(timeout_seconds=timeout_seconds)
        self.public_fred = PublicFredProvider(timeout_seconds=timeout_seconds)

    def get_snapshot(self) -> dict[str, Any]:
        snapshot = super().get_snapshot()
        observations = snapshot.setdefault("observations", {})

        # The base provider marks FRED NOT_CONFIGURED when no API key exists.
        # Fill those series from the public FRED graph CSV endpoint instead.
        fred_keys = ("fed_funds", "us_2y", "us_10y", "us_10y_2y_spread", "vix")
        missing = [key for key in fred_keys if not observations.get(key)]
        if not missing:
            return snapshot

        try:
            public_rows = self.public_fred.get_snapshot()
            for key in missing:
                if public_rows.get(key):
                    observations[key] = public_rows[key]
            if any(observations.get(key) for key in fred_keys):
                snapshot["source_status"]["fred"] = "CURRENT"
        except Exception:
            # Preserve the existing source status; never fabricate macro data.
            pass

        return snapshot
