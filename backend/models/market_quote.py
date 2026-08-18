from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class MarketQuote:
    """Normalized online market snapshot exposed by PAL."""

    symbol: str
    price: float | None = None
    previous_price: float | None = None
    change: float | None = None
    change_percent: float | None = None
    timestamp: str | None = None
    source: str = ""
    status: str = "UNAVAILABLE"
    freshness_seconds: int | None = None
    unit: str = "price"
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)

        if self.timestamp:
            try:
                dt = datetime.fromisoformat(
                    self.timestamp.replace("Z", "+00:00")
                )
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                payload["freshness_seconds"] = max(
                    0,
                    int(
                        (
                            datetime.now(timezone.utc) - dt.astimezone(timezone.utc)
                        ).total_seconds()
                    ),
                )
            except ValueError:
                pass

        return payload
