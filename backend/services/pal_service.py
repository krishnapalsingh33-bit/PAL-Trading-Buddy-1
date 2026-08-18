from datetime import datetime

from analysis.news_engine import NewsEngine
from analysis.macro_bias_engine import MacroBiasEngine
from analysis.report_engine import ReportEngine
from providers.google_news_provider import GoogleNewsProvider


class PALService:
    """
    PAL Macro Intelligence Service.

    PAL is focused exclusively on:

    - macroeconomic intelligence
    - important economic events
    - recent macro catalysts
    - macro news headlines
    - USD macro news
    - GBP macro news
    - GBP/USD cross-market news
    - fundamental directional bias
    - market risks
    - concise fundamental context

    PAL does NOT:

    - analyze trading strategy
    - analyze chart structure
    - generate entries
    - generate execution plans
    - calculate setup stages
    - determine trade readiness
    """

    def __init__(self):

        # ==========================================================
        # NEWS ENGINE
        # ==========================================================

        self.news_engine = NewsEngine()

        # ==========================================================
        # GOOGLE NEWS
        # ==========================================================

        self.google_news_provider = (
            GoogleNewsProvider()
        )

        # ==========================================================
        # MACRO BIAS ENGINE
        # ==========================================================

        self.macro_bias_engine = (
            MacroBiasEngine()
        )

        # ==========================================================
        # REPORT ENGINE
        # ==========================================================

        self.report_engine = ReportEngine()

    def analyze(
        self,
        symbol: str,
        news_events: list[dict],
        current_time: datetime,
    ):

        # ==========================================================
        # GOOGLE NEWS
        # ==========================================================

        try:

            headlines = (
                self.google_news_provider.get_headlines()
            )

        except Exception as ex:

            print(
                "Google News provider failed: "
                f"{ex}"
            )

            headlines = []

        # ==========================================================
        # NEWS / MACRO INTELLIGENCE
        # ==========================================================

        news = self.news_engine.analyze(
            events=news_events,
            now=current_time,
            articles=headlines,
        )

        # ==========================================================
        # MACRO BIAS
        # ==========================================================
        #
        # IMPORTANT:
        # MacroBiasEngine.analyze() does not accept `now`.
        # Passing now here causes:
        #
        # TypeError:
        # unexpected keyword argument 'now'
        #
        # Keep the call compatible with the engine.
        #

        try:

            macro_bias = (
                self.macro_bias_engine.analyze(
                    news=news,
                )
            )

        except Exception as ex:

            print(
                "Macro bias engine failed: "
                f"{ex}"
            )

            macro_bias = {
                "dxy": {
                    "bias": "UNKNOWN",
                    "bullish": None,
                    "bearish": None,
                },

                "gbp": {
                    "bias": "UNKNOWN",
                    "bullish": None,
                    "bearish": None,
                },

                "gbpusd": {
                    "bias": "UNKNOWN",
                    "bullish": None,
                    "bearish": None,
                },

                "confidence": None,

                "summary": (
                    "Macro bias could not be calculated."
                ),

                "evidence": [],
            }

        # ==========================================================
        # MERGE MACRO BIAS
        # ==========================================================

        news["macro_bias"] = macro_bias

        # ==========================================================
        # FINAL PAL REPORT
        # ==========================================================

        return self.report_engine.build(
            symbol=symbol,
            news=news,
        )