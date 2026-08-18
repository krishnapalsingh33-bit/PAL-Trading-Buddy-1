from abc import ABC, abstractmethod

from models.market_context import MarketContext


class MarketProvider(ABC):

    @abstractmethod
    def get_symbol_data(self, symbol: str) -> MarketContext:
        pass