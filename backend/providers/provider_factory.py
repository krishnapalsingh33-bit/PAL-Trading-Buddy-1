from __future__ import annotations

from providers.market_data_provider import MarketDataProvider
from providers.online_market_data_provider import YahooMarketDataProvider


class ProviderFactory:
    """Central factory for the online market-data provider."""

    _provider: MarketDataProvider | None = None

    @classmethod
    def get_provider(cls) -> MarketDataProvider:
        if cls._provider is None:
            cls._provider = YahooMarketDataProvider()
        return cls._provider

    @classmethod
    def reset(cls) -> None:
        cls._provider = None
