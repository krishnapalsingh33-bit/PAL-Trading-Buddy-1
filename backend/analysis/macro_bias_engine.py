from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


class MacroBiasEngine:
    """
    PAL Macro Bias Engine

    Purpose:
        Convert macro/news evidence into:
            - DXY / USD macro bias
            - GBP macro bias
            - GBP/USD macro bias
            - confidence
            - supporting reasons
            - cross-market context

    IMPORTANT:
        This engine is FUNDAMENTAL ONLY.

        It must NOT:
            - generate entries
            - generate stop losses
            - generate targets
            - generate execution plans
            - generate trading workflow
            - override price action
            - treat a price-only headline as fundamental evidence

    Design philosophy:
        1. Direct macro evidence gets the strongest weight.
        2. Central-bank repricing gets strong weight.
        3. Economic data gets strong weight.
        4. General currency commentary gets limited weight.
        5. Pure technical/price headlines get ZERO macro score.
        6. Cross-market headlines are context only.
        7. Conflicting evidence reduces confidence.
        8. Weak evidence remains NEUTRAL.
    """

    # ==========================================================
    # SCORE LIMITS
    # ==========================================================

    MAX_SCORE = 5.0
    MIN_SCORE = -5.0

    # Bias thresholds.
    #
    # We deliberately keep these reasonably wide.
    # One weak headline should not flip the whole macro picture.

    LEAN_THRESHOLD = 1.25
    BULLISH_THRESHOLD = 2.50

    # Confidence thresholds.

    MIN_CONFIDENCE_FOR_LEAN = 35
    MIN_CONFIDENCE_FOR_DIRECTIONAL = 60

    # ==========================================================
    # SOURCE / EVIDENCE WEIGHTS
    # ==========================================================

    SOURCE_WEIGHTS = {
        "reuters": 1.00,
        "wsj": 1.00,
        "financial times": 1.00,
        "ft": 1.00,
        "bloomberg": 1.00,
        "cnbc": 0.90,
        "pbs": 0.85,
        "yahoo finance": 0.80,
        "fxstreet": 0.75,
        "tradingview": 0.70,
        "ing": 0.85,
        "continuum economics": 0.80,
        "exchange rates": 0.60,
        "global banking": 0.60,
        "cryptorank": 0.50,
        "cryptobriefing": 0.40,
        "bitcoin world": 0.35,
        "insurancenewsnet": 0.35,
    }

    # ==========================================================
    # PRICE / TECHNICAL LANGUAGE
    # ==========================================================

    PRICE_ONLY_TERMS = (
        "stretches to",
        "three-month high",
        "three month high",
        "three-month highs",
        "three month highs",
        "climbs toward",
        "edges higher",
        "edges lower",
        "steadies",
        "steady above",
        "falls sharply",
        "rises sharply",
        "slips below",
        "slips",
        "soars",
        "rallies",
        "gains",
        "advances",
        "poised for further gains",
        "outlook",
        "price news",
        "technical",
        "support",
        "resistance",
        "breakout",
        "oversold",
        "overbought",
        "chart",
        "trendline",
        "moving average",
        "target",
    )

    # ==========================================================
    # USD / FED MACRO TERMS
    # ==========================================================

    USD_BULLISH_TERMS = (
        "fed rate hike",
        "fed hikes",
        "rate hike bets rise",
        "rate hike expectations rise",
        "higher for longer",
        "hawkish fed",
        "hawkish federal reserve",
        "fed tightening",
        "tightening concerns",
        "strong us inflation",
        "hot us inflation",
        "sticky us inflation",
        "us inflation remains elevated",
        "strong us jobs",
        "strong us payrolls",
        "strong nonfarm payrolls",
        "strong employment",
        "falling unemployment",
        "wage growth accelerates",
        "strong retail sales",
        "strong us retail sales",
        "strong us growth",
        "us growth accelerates",
        "strong economic growth",
        "robust us economy",
    )

    USD_BEARISH_TERMS = (
        "fed rate cut",
        "fed cuts",
        "rate cut bets rise",
        "rate cut expectations rise",
        "rate hike bets fade",
        "rate hike expectations fade",
        "dovish fed",
        "dovish federal reserve",
        "fed easing",
        "easing concerns",
        "weak us inflation",
        "soft us inflation",
        "cooling us inflation",
        "us inflation falls",
        "weak us jobs",
        "weak us payrolls",
        "weak nonfarm payrolls",
        "weak employment",
        "rising unemployment",
        "jobless claims rise",
        "higher jobless claims",
        "weak retail sales",
        "weak us retail sales",
        "us retail sales fall",
        "retail sales drop",
        "weak us growth",
        "us growth slows",
        "slowing us growth",
        "economic slowdown",
        "recession concerns",
        "fed rate rise prospects dim",
        "prospects dim for fed rate rise",
    )

    # ==========================================================
    # GBP / BOE MACRO TERMS
    # ==========================================================

    GBP_BULLISH_TERMS = (
        "boe rate hike",
        "boe hikes",
        "bank of england rate hike",
        "bank of england hikes",
        "boe tightening",
        "hawkish boe",
        "hawkish bank of england",
        "boe repricing higher",
        "rate hike expectations rise",
        "higher boe rates",
        "uk inflation rises",
        "uk inflation remains elevated",
        "hot uk inflation",
        "strong uk inflation",
        "strong uk growth",
        "uk growth accelerates",
        "strong uk economy",
        "uk employment strengthens",
        "uk wages accelerate",
        "wage growth accelerates",
        "unemployment falls",
    )

    GBP_BEARISH_TERMS = (
        "boe rate cut",
        "boe cuts",
        "bank of england rate cut",
        "bank of england cuts",
        "boe easing",
        "dovish boe",
        "dovish bank of england",
        "boe repricing lower",
        "rate cut expectations rise",
        "lower boe rates",
        "uk inflation falls",
        "cooling uk inflation",
        "soft uk inflation",
        "weak uk growth",
        "uk growth slows",
        "slowing uk growth",
        "uk recession concerns",
        "uk employment weakens",
        "uk wages slow",
        "wage growth slows",
        "unemployment rises",
    )

    # ==========================================================
    # SPECIAL MACRO PHRASES
    # ==========================================================

    SPECIAL_RULES = {

        # ------------------------------
        # USD
        # ------------------------------

        "weak u.s. retail sales": ("usd", -1.0),
        "weak us retail sales": ("usd", -1.0),
        "retail sales unexpectedly post largest drop": ("usd", -1.2),
        "weak u.s. growth data": ("usd", -0.9),
        "weak us growth data": ("usd", -0.9),

        "dollar falls sharply as prospects dim for fed rate rise":
            ("usd", -1.1),

        "prospects dim for fed rate rise":
            ("usd", -1.0),

        "markets pare fed rate risks":
            ("usd", -0.8),

        "traders pare bets on fed rate hike":
            ("usd", -0.8),

        # ------------------------------
        # GBP
        # ------------------------------

        "data-heavy week risks boe repricing":
            ("gbp", 0.0),

        "boe repricing":
            ("gbp", 0.0),

        "uk inflation test":
            ("gbp", 0.0),

        # These are deliberately neutral because
        # the phrase describes an upcoming test,
        # not its result.

        "sterling advances ahead of uk economic data":
            ("gbp", 0.0),

        "ahead of uk economic data and boe rate outlook":
            ("gbp", 0.0),
    }

    # ==========================================================
    # CONSTRUCTOR
    # ==========================================================

    def __init__(self) -> None:
        pass

    # ==========================================================
    # PUBLIC API
    # ==========================================================

    def analyze(
    self,
    news: dict[str, Any],
    now: datetime | None = None,
    symbol: str = "GBPUSD",
):

        symbol = symbol.upper()

        headlines = self._get_headlines(news)

        usd_headlines = self._get_bucket(
            news,
            "usd",
            "usd_news",
        )

        gbp_headlines = self._get_bucket(
            news,
            "gbp",
            "gbp_news",
        )

        cross_headlines = self._get_bucket(
            news,
            "cross",
            "cross_news",
        )

        # If the news provider has not supplied buckets,
        # build them ourselves from the master headline list.

        if not usd_headlines:
            usd_headlines = [
                h for h in headlines
                if self._currency(h) == "USD"
            ]

        if not gbp_headlines:
            gbp_headlines = [
                h for h in headlines
                if self._currency(h) == "GBP"
            ]

        if not cross_headlines:
            cross_headlines = [
                h for h in headlines
                if self._currency(h) == "CROSS"
            ]

        # ======================================================
        # SCORE DIRECT FUNDAMENTAL EVIDENCE
        # ======================================================

        usd_result = self._score_currency(
            currency="USD",
            headlines=usd_headlines,
        )

        gbp_result = self._score_currency(
            currency="GBP",
            headlines=gbp_headlines,
        )

        # ======================================================
        # CROSS-MARKET CONTEXT
        # ======================================================

        cross_context = self._build_cross_context(
            cross_headlines=cross_headlines,
            usd_result=usd_result,
            gbp_result=gbp_result,
        )

        # ======================================================
        # GBP/USD
        # ======================================================

        gbpusd_result = self._build_gbpusd_bias(
            usd_result=usd_result,
            gbp_result=gbp_result,
            cross_context=cross_context,
        )

        # ======================================================
        # DXY
        # ======================================================

        dxy_result = {
            "bias": usd_result["bias"],
            "score": usd_result["score"],
            "confidence": usd_result["confidence"],
            "reasons": usd_result["reasons"],
        }

        # ======================================================
        # OVERALL CONFIDENCE
        # ======================================================

        overall_confidence = self._overall_confidence(
            usd_result,
            gbp_result,
            gbpusd_result,
        )

        # ======================================================
        # SUMMARY
        # ======================================================

        summary = (
            f"USD: {usd_result['bias']}. "
            f"GBP: {gbp_result['bias']}. "
            f"GBP/USD macro bias: {gbpusd_result['bias']}."
        )

        return {
            "dxy": dxy_result,

            "gbp": {
                "bias": gbp_result["bias"],
                "score": gbp_result["score"],
                "confidence": gbp_result["confidence"],
                "reasons": gbp_result["reasons"],
            },

            "gbpusd": {
                "bias": gbpusd_result["bias"],
                "score": gbpusd_result["score"],
                "confidence": gbpusd_result["confidence"],
                "reasons": gbpusd_result["reasons"],
            },

            "confidence": overall_confidence,

            "summary": summary,

            "cross_context": cross_context,
        }

    # ==========================================================
    # HEADLINE EXTRACTION
    # ==========================================================

    @staticmethod
    def _get_headlines(
        news: dict[str, Any],
    ) -> list[dict[str, Any]]:

        headlines = news.get("headlines", [])

        if not isinstance(headlines, list):
            return []

        return [
            h for h in headlines
            if isinstance(h, dict)
        ]

    # ==========================================================

    @staticmethod
    def _get_bucket(
        news: dict[str, Any],
        primary: str,
        secondary: str,
    ) -> list[dict[str, Any]]:

        result = news.get(primary)

        if not isinstance(result, list):
            result = news.get(secondary, [])

        if not isinstance(result, list):
            return []

        return [
            h for h in result
            if isinstance(h, dict)
        ]

    # ==========================================================
    # CURRENCY
    # ==========================================================

    @staticmethod
    def _currency(
        headline: dict[str, Any],
    ) -> str:

        currency = headline.get(
            "currency",
            "",
        )

        if not isinstance(currency, str):
            return ""

        return currency.upper()

    # ==========================================================
    # TEXT
    # ==========================================================

    @staticmethod
    def _headline_text(
        headline: dict[str, Any],
    ) -> str:

        title = headline.get(
            "title",
            "",
        )

        if not isinstance(title, str):
            return ""

        return title.strip()

    # ==========================================================
    # NORMALIZE
    # ==========================================================

    @staticmethod
    def _normalize(
        text: str,
    ) -> str:

        return (
            text.lower()
            .replace("’", "'")
            .replace("–", "-")
            .replace("—", "-")
            .replace("u.s.", "us")
            .replace("u.s", "us")
            .strip()
        )

    # ==========================================================
    # SOURCE WEIGHT
    # ==========================================================

    def _source_weight(
        self,
        headline: dict[str, Any],
    ) -> float:

        source = headline.get(
            "source",
            "",
        )

        if not isinstance(source, str):
            return 0.60

        source_lower = source.lower()

        for key, weight in self.SOURCE_WEIGHTS.items():

            if key in source_lower:
                return weight

        return 0.60

    # ==========================================================
    # IMPACT WEIGHT
    # ==========================================================

    @staticmethod
    def _impact_weight(
        headline: dict[str, Any],
    ) -> float:

        impact = headline.get(
            "impact",
            "",
        )

        if not isinstance(impact, str):
            return 0.70

        impact = impact.lower()

        if impact == "high":
            return 1.00

        if impact == "medium":
            return 0.85

        if impact == "low":
            return 0.55

        return 0.70

    # ==========================================================
    # PRICE-ONLY DETECTION
    # ==========================================================

    def _is_price_only(
        self,
        text: str,
    ) -> bool:

        normalized = self._normalize(text)

        # A headline can contain price language AND
        # fundamental language. Fundamental evidence wins.

        fundamental_markers = (
            "fed",
            "federal reserve",
            "rate hike",
            "rate cut",
            "interest rate",
            "inflation",
            "cpi",
            "pce",
            "ppi",
            "retail sales",
            "payrolls",
            "nonfarm",
            "employment",
            "unemployment",
            "jobless claims",
            "gdp",
            "growth",
            "boe",
            "bank of england",
            "wages",
            "wage growth",
        )

        has_fundamental = any(
            marker in normalized
            for marker in fundamental_markers
        )

        if has_fundamental:
            return False

        price_hits = sum(
            1
            for term in self.PRICE_ONLY_TERMS
            if term in normalized
        )

        return price_hits > 0

    # ==========================================================
    # SPECIAL RULE
    # ==========================================================

    def _special_score(
        self,
        currency: str,
        text: str,
    ) -> float | None:

        normalized = self._normalize(text)

        for phrase, (
            rule_currency,
            score,
        ) in self.SPECIAL_RULES.items():

            if rule_currency != currency.lower():
                continue

            if phrase in normalized:
                return score

        return None

    # ==========================================================
    # KEYWORD SCORE
    # ==========================================================

    def _keyword_score(
        self,
        currency: str,
        text: str,
    ) -> float:

        normalized = self._normalize(text)

        if currency == "USD":

            bullish_terms = self.USD_BULLISH_TERMS
            bearish_terms = self.USD_BEARISH_TERMS

        elif currency == "GBP":

            bullish_terms = self.GBP_BULLISH_TERMS
            bearish_terms = self.GBP_BEARISH_TERMS

        else:
            return 0.0

        bullish_hits = [
            term
            for term in bullish_terms
            if term in normalized
        ]

        bearish_hits = [
            term
            for term in bearish_terms
            if term in normalized
        ]

        # Conflicting wording in one headline should not
        # create a strong directional score.

        if bullish_hits and bearish_hits:
            return 0.0

        if bullish_hits:
            return 1.0

        if bearish_hits:
            return -1.0

        return 0.0

    # ==========================================================
    # SCORE SINGLE HEADLINE
    # ==========================================================

    def _score_headline(
        self,
        currency: str,
        headline: dict[str, Any],
    ) -> tuple[float, str | None]:

        text = self._headline_text(
            headline
        )

        if not text:
            return 0.0, None

        # ------------------------------------------------------
        # NEVER score pure price-action headlines.
        # ------------------------------------------------------

        if self._is_price_only(text):
            return 0.0, None

        # ------------------------------------------------------
        # SPECIAL RULES
        # ------------------------------------------------------

        special = self._special_score(
            currency=currency,
            text=text,
        )

        if special is not None:

            if special == 0.0:
                return 0.0, None

            weight = (
                self._source_weight(headline)
                * self._impact_weight(headline)
            )

            score = special * weight

            return score, text

        # ------------------------------------------------------
        # NORMAL MACRO KEYWORDS
        # ------------------------------------------------------

        direction = self._keyword_score(
            currency=currency,
            text=text,
        )

        if direction == 0.0:
            return 0.0, None

        weight = (
            self._source_weight(headline)
            * self._impact_weight(headline)
        )

        # Stronger central-bank language gets more weight.

        normalized = self._normalize(text)

        central_bank_terms = (
            "fed",
            "federal reserve",
            "boe",
            "bank of england",
            "rate hike",
            "rate cut",
            "monetary policy",
            "rate expectations",
            "rate repricing",
        )

        if any(
            term in normalized
            for term in central_bank_terms
        ):
            weight *= 1.15

        # Actual data language gets a moderate boost.

        data_terms = (
            "cpi",
            "inflation",
            "retail sales",
            "payrolls",
            "employment",
            "unemployment",
            "jobless claims",
            "gdp",
            "wages",
            "growth",
        )

        if any(
            term in normalized
            for term in data_terms
        ):
            weight *= 1.10

        score = direction * weight

        return score, text

    # ==========================================================
    # SCORE CURRENCY
    # ==========================================================

    def _score_currency(
        self,
        currency: str,
        headlines: list[dict[str, Any]],
    ) -> dict[str, Any]:

        raw_score = 0.0

        reasons: list[str] = []

        positive_count = 0
        negative_count = 0

        scored_headlines = 0

        for headline in headlines:

            score, reason = self._score_headline(
                currency=currency,
                headline=headline,
            )

            if score == 0.0:
                continue

            scored_headlines += 1

            raw_score += score

            if score > 0:
                positive_count += 1
            elif score < 0:
                negative_count += 1

            if reason:
                reasons.append(
                    reason
                )

        # ------------------------------------------------------
        # Clamp score.
        # ------------------------------------------------------

        score = max(
            self.MIN_SCORE,
            min(
                self.MAX_SCORE,
                raw_score,
            ),
        )

        # ------------------------------------------------------
        # Determine bias.
        # ------------------------------------------------------

        bias = self._score_to_bias(
            score=score,
            scored_headlines=scored_headlines,
        )

        # ------------------------------------------------------
        # Confidence.
        # ------------------------------------------------------

        confidence = self._calculate_confidence(
            score=score,
            scored_headlines=scored_headlines,
            positive_count=positive_count,
            negative_count=negative_count,
        )

        # Remove duplicate reasons while preserving order.

        reasons = list(
            dict.fromkeys(reasons)
        )

        return {
            "bias": bias,
            "score": round(score, 2),
            "confidence": confidence,
            "reasons": reasons,
            "positive_count": positive_count,
            "negative_count": negative_count,
        }

    # ==========================================================
    # SCORE -> BIAS
    # ==========================================================

    def _score_to_bias(
        self,
        score: float,
        scored_headlines: int,
    ) -> str:

        # No evidence.

        if scored_headlines == 0:
            return "NEUTRAL"

        if score >= self.BULLISH_THRESHOLD:
            return "BULLISH"

        if score <= -self.BULLISH_THRESHOLD:
            return "BEARISH"

        if score >= self.LEAN_THRESHOLD:
            return "LEAN_BULLISH"

        if score <= -self.LEAN_THRESHOLD:
            return "LEAN_BEARISH"

        return "NEUTRAL"

    # ==========================================================
    # CONFIDENCE
    # ==========================================================

    @staticmethod
    def _calculate_confidence(
        score: float,
        scored_headlines: int,
        positive_count: int,
        negative_count: int,
    ) -> int:

        if scored_headlines == 0:
            return 0

        absolute_score = abs(score)

        # Base confidence from magnitude.

        confidence = min(
            100,
            int(
                absolute_score
                / 4.0
                * 100
            ),
        )

        # More independent pieces of evidence help.

        if scored_headlines >= 2:
            confidence += 10

        if scored_headlines >= 3:
            confidence += 5

        # Conflicting evidence reduces confidence.

        if positive_count > 0 and negative_count > 0:
            confidence -= 20

        return max(
            0,
            min(
                100,
                confidence,
            ),
        )

    # ==========================================================
    # GBP/USD BIAS
    # ==========================================================

    def _build_gbpusd_bias(
        self,
        usd_result: dict[str, Any],
        gbp_result: dict[str, Any],
        cross_context: list[str],
    ) -> dict[str, Any]:

        usd_score = float(
            usd_result.get(
                "score",
                0.0,
            )
        )

        gbp_score = float(
            gbp_result.get(
                "score",
                0.0,
            )
        )

        # GBP/USD rises when:
        #
        # GBP strengthens
        # USD weakens
        #
        # Therefore:
        #
        # GBP/USD score = GBP score - USD score

        differential = (
            gbp_score
            - usd_score
        )

        # Keep the pair score bounded.

        differential = max(
            -self.MAX_SCORE,
            min(
                self.MAX_SCORE,
                differential,
            ),
        )

        reasons: list[str] = []

        # ------------------------------------------------------
        # GBP contribution
        # ------------------------------------------------------

        if gbp_score > 0:

            reasons.append(
                "GBP macro evidence is supportive."
            )

        elif gbp_score < 0:

            reasons.append(
                "GBP macro evidence is negative."
            )

        # ------------------------------------------------------
        # USD contribution
        # ------------------------------------------------------

        if usd_score < 0:

            reasons.append(
                "USD macro evidence is negative, "
                "which supports GBP/USD."
            )

        elif usd_score > 0:

            reasons.append(
                "USD macro evidence is supportive, "
                "which weighs on GBP/USD."
            )

        # ------------------------------------------------------
        # Direction
        # ------------------------------------------------------

        if (
            differential
            >= self.BULLISH_THRESHOLD
        ):

            bias = "BULLISH"

        elif (
            differential
            <= -self.BULLISH_THRESHOLD
        ):

            bias = "BEARISH"

        elif (
            differential
            >= self.LEAN_THRESHOLD
        ):

            bias = "LEAN_BULLISH"

        elif (
            differential
            <= -self.LEAN_THRESHOLD
        ):

            bias = "LEAN_BEARISH"

        else:

            bias = "NEUTRAL"

        # ------------------------------------------------------
        # Confidence
        # ------------------------------------------------------

        confidence = min(
            100,
            int(
                abs(differential)
                / 4.0
                * 100
            ),
        )

        # Pair confidence should consider both currencies.

        currency_confidence = int(
            (
                usd_result.get(
                    "confidence",
                    0,
                )
                +
                gbp_result.get(
                    "confidence",
                    0,
                )
            )
            / 2
        )

        if currency_confidence > 0:

            confidence = int(
                (
                    confidence
                    + currency_confidence
                )
                / 2
            )

        # ------------------------------------------------------
        # If neither currency has evidence,
        # explicitly state insufficient evidence.
        # ------------------------------------------------------

        if (
            abs(usd_score) < 0.01
            and abs(gbp_score) < 0.01
        ):

            bias = "NEUTRAL"

            confidence = 0

            reasons = [
                "Insufficient macro evidence "
                "to establish a GBP/USD direction."
            ]

        # ------------------------------------------------------
        # Cross context is supporting evidence only.
        # ------------------------------------------------------

        if cross_context:

            if differential > 0:

                reasons.append(
                    "Market context provides "
                    "additional GBP/USD upside support."
                )

            elif differential < 0:

                reasons.append(
                    "Market context provides "
                    "additional GBP/USD downside pressure."
                )

        return {
            "bias": bias,
            "score": round(
                differential,
                2,
            ),
            "confidence": max(
                0,
                min(
                    100,
                    confidence,
                ),
            ),
            "reasons": list(
                dict.fromkeys(reasons)
            ),
        }

    # ==========================================================
    # CROSS-MARKET CONTEXT
    # ==========================================================

    def _build_cross_context(
        self,
        cross_headlines: list[dict[str, Any]],
        usd_result: dict[str, Any],
        gbp_result: dict[str, Any],
    ) -> list[str]:

        context: list[str] = []

        for headline in cross_headlines:

            title = self._headline_text(
                headline
            )

            if not title:
                continue

            normalized = self._normalize(
                title
            )

            # --------------------------------------------------
            # GBP/USD upside context
            # --------------------------------------------------

            gbp_up_terms = (
                "gbp/usd gains",
                "gbp/usd climbs",
                "gbp/usd higher",
                "pound climbs",
                "sterling advances",
                "pound gains",
                "sterling gains",
                "further gains",
            )

            usd_down_terms = (
                "dollar falls",
                "dollar slips",
                "dollar weakens",
                "dollar dips",
                "fed rate risks",
                "fed rate hike bets fade",
            )

            # --------------------------------------------------
            # GBP/USD downside context
            # --------------------------------------------------

            gbp_down_terms = (
                "gbp/usd falls",
                "gbp/usd declines",
                "gbp/usd lower",
                "pound slips",
                "sterling falls",
                "sterling weakens",
                "pound falls",
            )

            usd_up_terms = (
                "dollar rises",
                "dollar strengthens",
                "dollar gains",
                "fed tightening",
                "fed rate hike bets rise",
            )

            if any(
                term in normalized
                for term in gbp_up_terms
            ):

                context.append(
                    f"GBP/USD market context: {title}"
                )

            elif any(
                term in normalized
                for term in usd_down_terms
            ):

                context.append(
                    f"USD market context: {title}"
                )

            elif any(
                term in normalized
                for term in gbp_down_terms
            ):

                context.append(
                    f"GBP/USD downside context: {title}"
                )

            elif any(
                term in normalized
                for term in usd_up_terms
            ):

                context.append(
                    f"USD strength context: {title}"
                )

        # ------------------------------------------------------
        # Add high-level relationship context.
        #
        # This is NOT added to the score.
        # ------------------------------------------------------

        if (
            usd_result["score"] < 0
            and gbp_result["score"] > 0
        ):

            context.append(
                "Cross-market evidence supports GBP/USD upside."
            )

        elif (
            usd_result["score"] > 0
            and gbp_result["score"] < 0
        ):

            context.append(
                "Cross-market evidence supports GBP/USD downside."
            )

        elif (
            usd_result["score"] < 0
            and gbp_result["score"] == 0
        ):

            context.append(
                "USD weakness provides a mild "
                "GBP/USD supportive backdrop."
            )

        elif (
            usd_result["score"] > 0
            and gbp_result["score"] == 0
        ):

            context.append(
                "USD strength provides a mild "
                "GBP/USD headwind."
            )

        return list(
            dict.fromkeys(context)
        )

    # ==========================================================
    # OVERALL CONFIDENCE
    # ==========================================================

    @staticmethod
    def _overall_confidence(
        usd_result: dict[str, Any],
        gbp_result: dict[str, Any],
        gbpusd_result: dict[str, Any],
    ) -> int:

        values = [
            usd_result.get(
                "confidence",
                0,
            ),
            gbp_result.get(
                "confidence",
                0,
            ),
            gbpusd_result.get(
                "confidence",
                0,
            ),
        ]

        non_zero = [
            value
            for value in values
            if value > 0
        ]

        if not non_zero:
            return 0

        return int(
            sum(non_zero)
            / len(non_zero)
        )

    # ==========================================================
    # OPTIONAL HELPER
    # ==========================================================

    @staticmethod
    def _now_iso() -> str:
        """
        Utility retained for compatibility with any
        future callers that need an engine timestamp.
        """

        return datetime.now(
            timezone.utc
        ).isoformat()