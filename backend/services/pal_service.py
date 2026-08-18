from datetime import datetime
import re

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

        # Do not let the headline keyword engine hide a clear macro release.
        # Recent actual-vs-forecast data is stronger evidence than generic news
        # wording, while upcoming events remain catalysts rather than bias.
        macro_bias = self._apply_macro_evidence_sanity(
            macro_bias,
            news,
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

    @classmethod
    def _apply_macro_evidence_sanity(cls, macro_bias: dict, news: dict) -> dict:
        if not isinstance(macro_bias, dict) or not isinstance(news, dict):
            return macro_bias

        headlines = news.get("headlines", [])
        if not isinstance(headlines, list):
            headlines = []

        # ------------------------------------------------------
        # News evidence
        # ------------------------------------------------------
        usd_bullish = (
            "hawkish fed", "hawkish federal reserve", "fed hike", "fed hikes",
            "rate hike bets rise", "rate hike expectations rise", "higher for longer",
            "strong us inflation", "hot us inflation", "sticky us inflation",
            "strong us jobs", "strong us payrolls", "strong nonfarm payrolls",
            "strong employment", "strong retail sales", "strong us growth",
            "us growth accelerates", "robust us economy", "unemployment falls",
            "inflation accelerates", "inflation reaccelerates", "jobs growth accelerates",
        )
        usd_bearish = (
            "dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts",
            "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade",
            "soft us inflation", "cooling us inflation", "us inflation falls",
            "weak us jobs", "weak us payrolls", "weak nonfarm payrolls",
            "weak employment", "rising unemployment", "weak retail sales",
            "us retail sales fall", "weak us growth", "us growth slows",
            "slowing us growth", "economic slowdown", "recession concerns",
            "inflation cools", "inflation eases", "jobs growth slows",
        )
        gbp_bullish = (
            "hawkish boe", "hawkish bank of england", "boe rate hike", "boe hikes",
            "bank of england rate hike", "uk inflation rises", "uk inflation remains elevated",
            "hot uk inflation", "strong uk growth", "uk growth accelerates",
            "strong uk economy", "uk employment strengthens", "uk wages accelerate",
            "wage growth accelerates", "unemployment falls", "uk inflation accelerates",
            "uk inflation reaccelerates", "uk jobs growth accelerates",
        )
        gbp_bearish = (
            "dovish boe", "dovish bank of england", "boe rate cut", "boe cuts",
            "bank of england rate cut", "cooling uk inflation", "uk inflation falls",
            "weak uk growth", "uk growth slows", "slowing uk growth",
            "uk recession concerns", "uk employment weakens", "uk wages slow",
            "wage growth slows", "unemployment rises", "cooling uk labour market",
            "cooling uk labor market", "soft labour market", "soft labor market",
            "uk inflation cools", "uk inflation eases", "uk jobs growth slows",
        )

        def normalize(text: object) -> str:
            value = str(text or "").lower()
            value = value.replace("’", "'").replace("–", "-").replace("—", "-")
            value = value.replace("u.s.", "us").replace("u.s", "us")
            return " ".join(value.split())

        def score_headlines(bucket: str, positive: tuple[str, ...], negative: tuple[str, ...]) -> float:
            total = 0.0
            for item in headlines:
                if not isinstance(item, dict):
                    continue
                if str(item.get("currency", "")).upper() != bucket:
                    continue
                title = normalize(item.get("title"))
                source = normalize(item.get("source"))
                weight = 1.25 if any(
                    name in source
                    for name in ("reuters", "bloomberg", "financial times", "wall street journal")
                ) else 1.0
                positive_hits = sum(1 for term in positive if term in title)
                negative_hits = sum(1 for term in negative if term in title)
                # Conflicting language inside one headline is weak evidence.
                if positive_hits and negative_hits:
                    continue
                total += weight * positive_hits
                total -= weight * negative_hits
            return max(-5.0, min(5.0, total))

        usd_news_score = score_headlines("USD", usd_bullish, usd_bearish)
        gbp_news_score = score_headlines("GBP", gbp_bullish, gbp_bearish)

        # ------------------------------------------------------
        # Recent economic-release evidence
        # ------------------------------------------------------
        recent_events = news.get("recent_events", [])
        if not isinstance(recent_events, list):
            recent_events = []

        def number(value: object) -> float | None:
            if value is None:
                return None
            match = re.search(r"[-+]?\d+(?:\.\d+)?", str(value).replace(",", ""))
            if not match:
                return None
            try:
                return float(match.group(0))
            except ValueError:
                return None

        def release_score(event: dict) -> float:
            currency = str(event.get("currency", "")).upper()
            if currency not in {"USD", "GBP"}:
                return 0.0

            title = normalize(event.get("title"))
            actual = number(event.get("actual"))
            forecast = number(event.get("forecast"))
            if actual is None or forecast is None:
                return 0.0

            surprise = actual - forecast
            if abs(surprise) < 1e-9:
                return 0.0

            # Stronger-than-expected inflation can support a currency through
            # higher-rate expectations; weaker inflation generally does the reverse.
            inflation = any(term in title for term in ("cpi", "inflation", "pce", "ppi"))
            employment = any(term in title for term in ("payroll", "employment", "jobs", "jobless claims", "unemployment"))
            growth = any(term in title for term in ("gdp", "retail sales", "pmi", "consumer confidence", "consumer sentiment"))

            if inflation:
                direction = 1.0 if surprise > 0 else -1.0
            elif employment:
                if "unemployment" in title or "jobless claims" in title:
                    direction = -1.0 if surprise > 0 else 1.0
                else:
                    direction = 1.0 if surprise > 0 else -1.0
            elif growth:
                direction = 1.0 if surprise > 0 else -1.0
            else:
                return 0.0

            # A recent high-impact surprise should matter, but not overwhelm
            # several independent headlines. Cap each release contribution.
            magnitude = min(abs(surprise), 2.0) / 2.0
            return direction * (0.75 + 0.75 * magnitude)

        usd_release_score = 0.0
        gbp_release_score = 0.0
        release_reasons: list[str] = []

        for event in recent_events:
            if not isinstance(event, dict):
                continue
            value = release_score(event)
            if value == 0.0:
                continue
            currency = str(event.get("currency", "")).upper()
            if currency == "USD":
                usd_release_score += value
            elif currency == "GBP":
                gbp_release_score += value
            release_reasons.append(
                f"{currency} {event.get('title', 'macro release')} actual vs forecast"
            )

        usd_release_score = max(-3.0, min(3.0, usd_release_score))
        gbp_release_score = max(-3.0, min(3.0, gbp_release_score))

        usd_score = max(-5.0, min(5.0, usd_news_score + usd_release_score))
        gbp_score = max(-5.0, min(5.0, gbp_news_score + gbp_release_score))
        relative_score = gbp_score - usd_score

        def resolve(current: object, value: float) -> str:
            normalized = str(current or "").upper()
            # Do not overwrite a strong result from the primary engine.
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
            "usd": round(usd_news_score, 2),
            "gbp": round(gbp_news_score, 2),
            "gbpusd_relative": round(gbp_news_score - usd_news_score, 2),
        }
        macro_bias["release_scores"] = {
            "usd": round(usd_release_score, 2),
            "gbp": round(gbp_release_score, 2),
            "gbpusd_relative": round(gbp_release_score - usd_release_score, 2),
            "reasons": release_reasons[:10],
        }
        macro_bias["combined_scores"] = {
            "usd": round(usd_score, 2),
            "gbp": round(gbp_score, 2),
            "gbpusd_relative": round(relative_score, 2),
        }
        macro_bias["summary"] = (
            f"USD: {dxy_bias}. GBP: {gbp_bias}. "
            f"GBP/USD macro bias: {gbpusd_bias}."
        )
        return macro_bias
