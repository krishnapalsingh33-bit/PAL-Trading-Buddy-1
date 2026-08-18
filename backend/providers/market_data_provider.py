from __future__ import annotations

from abc import ABC, abstractmethod

from models.market_quote import MarketQuote


class MarketDataProvider(ABC):
    """Provider abstraction for cloud-safe online market snapshots."""

    @abstractmethod
    def get_quote(self, symbol: str) -> MarketQuote:
        """Return a normalized quote for a PAL market symbol."""
        raise NotImplementedError
