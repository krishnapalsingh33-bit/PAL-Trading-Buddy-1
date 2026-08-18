from datetime import datetime

from analysis.news_engine import NewsEngine
from analysis.macro_bias_engine import MacroBiasEngine
from analysis.report_engine import ReportEngine
from providers.google_news_provider import GoogleNewsProvider
from services.market_data_service import MarketDataService
from services.macro_data_service import MacroDataService


class PALService:
    """PAL macro/news intelligence plus independent live market snapshots."""

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

        # A neutral score is valid when evidence is weak. When the primary
        # engine is neutral/unknown, however, use only explicit macro language
        # from current USD/GBP news to avoid hiding a clear fundamental edge.
        macro_bias = self._apply_live_news_sanity(
            macro_bias,
            news.get("headlines", []),
        )

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

    @staticmethod
    def _apply_live_news_sanity(macro_bias: dict, headlines: list[dict]) -> dict:
        if not isinstance(macro_bias, dict) or not isinstance(headlines, list):
            return macro_bias

        usd_bullish = (
            "hawkish fed", "hawkish federal reserve", "fed hike", "fed hikes",
            "rate hike bets rise", "rate hike expectations rise", "higher for longer",
            "strong us inflation", "hot us inflation", "sticky us inflation",
            "strong us jobs", "strong us payrolls", "strong nonfarm payrolls",
            "strong employment", "strong retail sales", "strong us growth",
            "us growth accelerates", "robust us economy", "unemployment falls",
        )
        usd_bearish = (
            "dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts",
            "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade",
            "soft us inflation", "cooling us inflation", "us inflation falls",
            "weak us jobs", "weak us payrolls", "weak nonfarm payrolls",
            "weak employment", "rising unemployment", "weak retail sales",
            "us retail sales fall", "weak us growth", "us growth slows",
            "slowing us growth", "economic slowdown", "recession concerns",
        )
        gbp_bullish = (
            "hawkish boe", "hawkish bank of england", "boe rate hike", "boe hikes",
            "bank of england rate hike", "uk inflation rises", "uk inflation remains elevated",
            "hot uk inflation", "strong uk growth", "uk growth accelerates",
            "strong uk economy", "uk employment strengthens", "uk wages accelerate",
            "wage growth accelerates", "unemployment falls",
        )
        gbp_bearish = (
            "dovish boe", "dovish bank of england", "boe rate cut", "boe cuts",
            "bank of england rate cut", "cooling uk inflation", "uk inflation falls",
            "weak uk growth", "uk growth slows", "slowing uk growth",
            "uk recession concerns", "uk employment weakens", "uk wages slow",
            "wage growth slows", "unemployment rises", "cooling uk labour market",
            "cooling uk labor market", "soft labour market", "soft labor market",
        )

        def score(bucket: str, positive: tuple[str, ...], negative: tuple[str, ...]) -> float:
            total = 0.0
            for item in headlines:
                if not isinstance(item, dict):
                    continue
                currency = str(item.get("currency", "")).upper()
                if currency != bucket:
                    continue
                title = str(item.get("title", "")).lower()
                source = str(item.get("source", "")).lower()
                weight = 1.25 if any(
                    name in source
                    for name in ("reuters", "bloomberg", "financial times", "wall street journal")
                ) else 1.0
                total += weight * sum(1 for term in positive if term in title)
                total -= weight * sum(1 for term in negative if term in title)
            return max(-5.0, min(5.0, total))

        usd_score = score("USD", usd_bullish, usd_bearish)
        gbp_score = score("GBP", gbp_bullish, gbp_bearish)

        def resolve(current: object, value: float) -> str:
            normalized = str(current or "").upper()
            if normalized not in {"NEUTRAL", "UNKNOWN", ""}:
                return normalized
            if value >= 1.0:
                return "BULLISH"
            if value <= -1.0:
                return "BEARISH"
            return "NEUTRAL"

        dxy = dict(macro_bias.get("dxy") or {})
        gbp = dict(macro_bias.get("gbp") or {})
        gbpusd = dict(macro_bias.get("gbpusd") or {})

        dxy_bias = resolve(dxy.get("bias"), usd_score)
        gbp_bias = resolve(gbp.get("bias"), gbp_score)
        relative_score = gbp_score - usd_score
        gbpusd_bias = resolve(gbpusd.get("bias"), relative_score)

        dxy["bias"] = dxy_bias
        dxy["bullish"] = dxy_bias == "BULLISH"
        dxy["bearish"] = dxy_bias == "BEARISH"
        gbp["bias"] = gbp_bias
        gbp["bullish"] = gbp_bias == "BULLISH"
        gbp["bearish"] = gbp_bias == "BEARISH"
        gbpusd["bias"] = gbpusd_bias
        gbpusd["bullish"] = gbpusd_bias == "BULLISH"
        gbpusd["bearish"] = gbpusd_bias == "BEARISH"

        macro_bias["dxy"] = dxy
        macro_bias["gbp"] = gbp
        macro_bias["gbpusd"] = gbpusd
        macro_bias["live_news_scores"] = {
            "usd": round(usd_score, 2),
            "gbp": round(gbp_score, 2),
            "gbpusd_relative": round(relative_score, 2),
        }
        macro_bias["summary"] = (
            f"USD: {dxy_bias}. GBP: {gbp_bias}. "
            f"GBP/USD macro bias: {gbpusd_bias}."
        )
        return macro_bias
