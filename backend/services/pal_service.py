from datetime import datetime

from analysis.news_engine import NewsEngine
from analysis.macro_bias_engine import MacroBiasEngine
from analysis.report_engine import ReportEngine
from providers.google_news_provider import GoogleNewsProvider
from services.market_data_service import MarketDataService
from services.macro_data_service import MacroDataService


class PALService:
    """PAL macro/news intelligence plus independent market and macro snapshots."""

    def __init__(self):
        self.news_engine = NewsEngine()
        self.google_news_provider = GoogleNewsProvider()
        self.macro_bias_engine = MacroBiasEngine()
        self.report_engine = ReportEngine()
        self.market_data_service = MarketDataService()
        self.macro_data_service = MacroDataService()

    def analyze(self, symbol: str, news_events: list[dict], current_time: datetime):
        try:
            headlines = self.google_news_provider.get_headlines()
        except Exception as ex:
            print(f"Google News provider failed: {ex}")
            headlines = []

        news = self.news_engine.analyze(
            events=news_events,
            now=current_time,
            articles=headlines,
        )

        try:
            macro_bias = self.macro_bias_engine.analyze(news=news)
        except Exception as ex:
            print(f"Macro bias engine failed: {ex}")
            macro_bias = {
                "dxy": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                "gbp": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                "gbpusd": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                "confidence": None,
                "summary": "Macro bias could not be calculated.",
                "evidence": [],
            }

        try:
            markets = self.market_data_service.get_snapshot()
        except Exception as ex:
            print(f"Online market data service failed: {ex}")
            markets = {
                market_symbol: {
                    "symbol": market_symbol,
                    "price": None,
                    "previous_price": None,
                    "change": None,
                    "change_percent": None,
                    "timestamp": None,
                    "source": "online_provider",
                    "status": "UNAVAILABLE",
                    "freshness_seconds": None,
                    "unit": "price",
                    "reason": "Online market data is temporarily unavailable.",
                }
                for market_symbol in self.market_data_service.SYMBOLS
            }

        try:
            macro_data = self.macro_data_service.get_snapshot()
        except Exception as ex:
            print(f"Macro data service failed: {ex}")
            macro_data = {
                "source_status": {},
                "observations": {},
                "fetched_at": None,
            }

        news["macro_bias"] = macro_bias
        news["markets"] = markets
        news["macro_data"] = macro_data

        return self.report_engine.build(symbol=symbol, news=news)
