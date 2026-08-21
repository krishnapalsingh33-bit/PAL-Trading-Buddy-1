from datetime import datetime

from analysis.news_engine import NewsEngine
from analysis.macro_bias_engine import MacroBiasEngine
from analysis.today_only_bias_engine import TodayOnlyBiasEngine
from analysis.report_engine import ReportEngine
from providers.google_news_provider import GoogleNewsProvider
from providers.macro_news_provider import MacroNewsProvider
from services.market_data_service import MarketDataService
from services.macro_data_service import MacroDataService


class PALService:
    """PAL macro/news intelligence plus independent market and macro snapshots."""

    def __init__(self):
        self.news_engine = NewsEngine()
        self.google_news_provider = GoogleNewsProvider()
        self.gdelt_news_provider = MacroNewsProvider()
        self.macro_bias_engine = MacroBiasEngine()
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
    def _right_now_signal(momentum: float | None, change_percent: float | None) -> float | None:
        if momentum is not None:
            return momentum
        if change_percent is not None:
            return change_percent
        return None

    @staticmethod
    def _right_now_bias(signal: float | None) -> str:
        if signal is None:
            return "DATA UNAVAILABLE"
        if signal >= 0.03:
            return "BULLISH"
        if signal <= -0.03:
            return "BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _right_now_momentum_label(signal: float | None) -> str:
        if signal is None:
            return "— NO LIVE DATA"
        if signal >= 0.03:
            return "↑ BUYING"
        if signal <= -0.03:
            return "↓ SELLING"
        return "→ FLAT"

    @classmethod
    def _build_right_now(cls, markets: dict) -> dict:
        result: dict[str, dict] = {}
        for symbol in ("DXY", "GBP", "GBPUSD"):
            market_symbol = "GBPUSD" if symbol in {"GBP", "GBPUSD"} else "DXY"
            quote = markets.get(market_symbol) if isinstance(markets, dict) else None
            momentum = quote.get("right_now_momentum_percent") if isinstance(quote, dict) else None
            change_percent = quote.get("change_percent") if isinstance(quote, dict) else None
            try:
                momentum = float(momentum) if momentum is not None else None
            except (TypeError, ValueError):
                momentum = None
            try:
                change_percent = float(change_percent) if change_percent is not None else None
            except (TypeError, ValueError):
                change_percent = None
            signal = cls._right_now_signal(momentum, change_percent)
            result[symbol.lower()] = {
                "bias": cls._right_now_bias(signal),
                "momentum": round(signal, 4) if signal is not None else None,
                "direction": cls._right_now_momentum_label(signal),
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
            macro_bias = self.macro_bias_engine.analyze(news=news, now=current_time, symbol=symbol)
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

        macro_bias = self._apply_live_news_sanity(macro_bias, news.get("headlines", []))

        try:
            markets = self.market_data_service.get_snapshot()
        except Exception as ex:
            print(f"Online market data service failed: {ex}")
            markets = {
                market_symbol: {"symbol": market_symbol, "price": None, "previous_price": None, "change": None, "change_percent": None, "timestamp": None, "source": "online_provider", "status": "UNAVAILABLE", "freshness_seconds": None, "unit": "price", "reason": "Online market data is temporarily unavailable.", "right_now_momentum_percent": None}
                for market_symbol in self.market_data_service.SYMBOLS
            }

        try:
            macro_data = self.macro_data_service.get_snapshot()
        except Exception as ex:
            print(f"Macro data service failed: {ex}")
            macro_data = {"source_status": {}, "observations": {}, "fetched_at": None}

        try:
            today_bias = self.today_bias_engine.build(
                _macro_bias=macro_bias,
                news={**news, "markets": markets, "macro_data": macro_data},
                now=current_time,
            )
        except Exception as ex:
            print(f"Today-only bias engine failed: {ex}")
            today_bias = {"today": {"bias": "UNKNOWN", "score": 0, "confidence": 0, "reasons": ["Today bias is temporarily unavailable."], "evidence_count": 0, "scope": "TODAY_ONLY"}, "sessions": {}, "active_session": None}

        today_bias["today"]["right_now"] = self._build_right_now(markets)

        news["macro_bias"] = macro_bias
        news["today_bias"] = today_bias
        news["markets"] = markets
        news["macro_data"] = macro_data
        news["news_sources"] = {"google_news": len(google_headlines), "gdelt": len(gdelt_headlines), "merged": len(headlines)}
        return self.report_engine.build(symbol=symbol, news=news)

    @staticmethod
    def _apply_live_news_sanity(macro_bias: dict, headlines: list[dict]) -> dict:
        if not isinstance(macro_bias, dict) or not isinstance(headlines, list):
            return macro_bias
        usd_bullish = ("hawkish fed", "hawkish federal reserve", "fed hike", "rate hike bets rise", "higher for longer", "strong us inflation", "hot us inflation", "strong us jobs", "strong payrolls", "strong retail sales", "us growth accelerates")
        usd_bearish = ("dovish fed", "dovish federal reserve", "dovish response", "fed hold", "hold interest rates", "rate hike bets fade", "rate cut bets rise", "soft economic data", "unexpected job losses", "weak jobs", "weak payrolls", "weaker retail sales", "lower-than-expected inflation", "mild inflation", "soft us economy")
        gbp_bullish = ("hawkish boe", "hawkish bank of england", "boe rate hike", "boe hikes", "uk inflation rises", "uk inflation remains elevated", "strong uk growth", "uk growth accelerates", "uk wages accelerate", "uk employment strengthens")
        gbp_bearish = ("dovish boe", "dovish bank of england", "boe rate cut", "boe cuts", "cooling uk labour market", "cooling uk labor market", "uk labour market cool", "uk labor market cool", "vacancies fell", "job vacancies fell", "wage growth slowed", "uk wages slow", "uk employment weakens", "weak uk growth", "uk growth slows", "unemployment rises", "soft labour market", "soft labor market")

        def score(bucket, positive, negative):
            total = 0.0
            for item in headlines:
                if not isinstance(item, dict) or str(item.get("currency", "")).upper() != bucket:
                    continue
                title = str(item.get("title", "")).lower()
                source = str(item.get("source", "")).lower()
                weight = 1.25 if any(name in source for name in ("reuters", "bloomberg", "financial times", "wall street journal")) else 1.0
                total += weight * sum(1 for term in positive if term in title)
                total -= weight * sum(1 for term in negative if term in title)
            return max(-5.0, min(5.0, total))

        usd_score, gbp_score = score("USD", usd_bullish, usd_bearish), score("GBP", gbp_bullish, gbp_bearish)

        def resolve(current, value):
            normalized = str(current or "").upper()
            if normalized not in {"NEUTRAL", "UNKNOWN", ""}:
                return normalized
            return "BULLISH" if value >= 1.5 else ("BEARISH" if value <= -1.5 else "NEUTRAL")

        dxy, gbp, gbpusd = dict(macro_bias.get("dxy") or {}), dict(macro_bias.get("gbp") or {}), dict(macro_bias.get("gbpusd") or {})
        dxy_bias, gbp_bias = resolve(dxy.get("bias"), usd_score), resolve(gbp.get("bias"), gbp_score)
        relative_score = gbp_score - usd_score
        gbpusd_bias = resolve(gbpusd.get("bias"), relative_score)
        dxy.update({"bias": dxy_bias, "bullish": dxy_bias == "BULLISH", "bearish": dxy_bias == "BEARISH"})
        gbp.update({"bias": gbp_bias, "bullish": gbp_bias == "BULLISH", "bearish": gbp_bias == "BEARISH"})
        gbpusd.update({"bias": gbpusd_bias, "bullish": gbpusd_bias == "BULLISH", "bearish": gbpusd_bias == "BEARISH"})
        macro_bias["dxy"], macro_bias["gbp"], macro_bias["gbpusd"] = dxy, gbp, gbpusd
        macro_bias["live_news_scores"] = {"usd": round(usd_score, 2), "gbp": round(gbp_score, 2), "gbpusd_relative": round(relative_score, 2)}
        macro_bias["summary"] = f"USD: {dxy_bias}. GBP: {gbp_bias}. GBP/USD macro bias: {gbpusd_bias}."
        return macro_bias
