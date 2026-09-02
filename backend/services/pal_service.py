from datetime import datetime

from analysis.news_engine import NewsEngine
from analysis.evidence_bias_engine import EvidenceBiasEngine
from analysis.macro_bias_engine import MacroBiasEngine
from analysis.today_only_bias_engine import TodayOnlyBiasEngine
from analysis.report_engine import ReportEngine
from providers.google_news_provider import GoogleNewsProvider
from providers.macro_news_provider import MacroNewsProvider
from services.market_data_service import MarketDataService
from services.macro_data_service import MacroDataService


class PALService:
    """PAL fundamental market-intelligence service."""

    def __init__(self):
        self.news_engine = NewsEngine()
        self.google_news_provider = GoogleNewsProvider()
        self.gdelt_news_provider = MacroNewsProvider()
        self.evidence_bias_engine = EvidenceBiasEngine()
        self.legacy_macro_bias_engine = MacroBiasEngine()
        self.today_bias_engine = TodayOnlyBiasEngine()
        self.report_engine = ReportEngine()
        self.market_data_service = MarketDataService()
        self.macro_data_service = MacroDataService()

    @staticmethod
    def _merge_news_sources(google_headlines: list[dict], gdelt_headlines: list[dict]) -> list[dict]:
        merged = []
        seen = set()
        for article in [*(google_headlines or []), *(gdelt_headlines or [])]:
            if not isinstance(article, dict):
                continue
            title = str(article.get("title", "")).strip()
            if not title:
                continue
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized = dict(article)
            normalized.setdefault("provider", "Google News")
            normalized.setdefault("published_at", article.get("published", ""))
            merged.append(normalized)
        merged.sort(key=lambda item: str(item.get("published_at", item.get("published", ""))), reverse=True)
        return merged[:40]

    @staticmethod
    def _right_now_bias(momentum: float | None) -> str:
        if momentum is None:
            return "WARMING UP"
        if momentum >= 0.03:
            return "BULLISH"
        if momentum <= -0.03:
            return "BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _right_now_momentum_label(momentum: float | None) -> str:
        if momentum is None:
            return "• COLLECTING LIVE DATA"
        if momentum >= 0.03:
            return "↑ BUYING"
        if momentum <= -0.03:
            return "↓ SELLING"
        return "→ FLAT"

    @classmethod
    def _build_right_now(cls, markets: dict) -> dict:
        result: dict[str, dict] = {}
        for symbol in ("DXY", "GBP", "GBPUSD"):
            market_symbol = "GBPUSD" if symbol in {"GBP", "GBPUSD"} else "DXY"
            quote = markets.get(market_symbol) if isinstance(markets, dict) else None
            momentum = quote.get("right_now_momentum_percent") if isinstance(quote, dict) else None
            try:
                momentum = float(momentum) if momentum is not None else None
            except (TypeError, ValueError):
                momentum = None
            result[symbol.lower()] = {
                "bias": cls._right_now_bias(momentum),
                "momentum": round(momentum, 4) if momentum is not None else None,
                "direction": cls._right_now_momentum_label(momentum),
                "price": quote.get("price") if isinstance(quote, dict) else None,
                "status": str(quote.get("status", "UNAVAILABLE")) if isinstance(quote, dict) else "UNAVAILABLE",
                "source": "live_market_observation",
                "scope": "RIGHT_NOW",
            }
        return result

    def analyze(self, symbol: str, news_events: list[dict], current_time: datetime):
        try:
            google_headlines = self.google_news_provider.get_headlines()
        except Exception as ex:
            print(f"Google News provider failed: {ex}")
            google_headlines = []
        try:
            gdelt_headlines = self.gdelt_news_provider.get_news()
        except Exception as ex:
            print(f"GDELT news provider failed: {ex}")
            gdelt_headlines = []

        headlines = self._merge_news_sources(google_headlines, gdelt_headlines)
        news = self.news_engine.analyze(events=news_events, now=current_time, articles=headlines)

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
                    "right_now_momentum_percent": None,
                }
                for market_symbol in self.market_data_service.SYMBOLS
            }

        try:
            macro_data = self.macro_data_service.get_snapshot()
        except Exception as ex:
            print(f"Macro data service failed: {ex}")
            macro_data = {"source_status": {}, "observations": {}, "fetched_at": None}

        # Primary bias is now calculated only after PAL has the full evidence set:
        # released calendar surprises + current macro headlines + supporting yields.
        try:
            macro_bias = self.evidence_bias_engine.analyze(
                events=news_events,
                headlines=news.get("headlines", []),
                markets=markets,
                now=current_time,
            )
        except Exception as ex:
            print(f"Evidence bias engine failed: {ex}")
            try:
                macro_bias = self.legacy_macro_bias_engine.analyze(news=news, now=current_time, symbol=symbol)
            except Exception as legacy_ex:
                print(f"Legacy macro bias engine failed: {legacy_ex}")
                macro_bias = {
                    "dxy": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                    "gbp": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                    "gbpusd": {"bias": "UNKNOWN", "bullish": None, "bearish": None},
                    "confidence": None,
                    "summary": "Macro bias could not be calculated.",
                    "evidence": [],
                }

        try:
            today_bias = self.today_bias_engine.build(
                _macro_bias=macro_bias,
                news={**news, "markets": markets, "macro_data": macro_data},
                now=current_time,
            )
        except Exception as ex:
            print(f"Today-only bias engine failed: {ex}")
            today_bias = {
                "today": {
                    "bias": "UNKNOWN",
                    "score": 0,
                    "confidence": 0,
                    "reasons": ["Today bias is temporarily unavailable."],
                    "evidence_count": 0,
                    "scope": "TODAY_ONLY",
                },
                "sessions": {},
                "active_session": None,
            }

        today_bias["today"]["right_now"] = self._build_right_now(markets)

        news["macro_bias"] = macro_bias
        news["today_bias"] = today_bias
        news["markets"] = markets
        news["macro_data"] = macro_data
        news["news_sources"] = {
            "google_news": len(google_headlines),
            "gdelt": len(gdelt_headlines),
            "merged": len(headlines),
        }
        return self.report_engine.build(symbol=symbol, news=news)
