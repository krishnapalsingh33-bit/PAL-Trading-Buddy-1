from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


class EvidenceBiasEngine:
    """
    Fundamental market-intelligence layer for DXY and GBP/USD.

    Combines released calendar surprises, macro headlines, and supporting
    rates context. Upcoming events without an actual result are risk only.
    Never produces entries, stops, targets, or execution instructions.
    """

    SOURCE_WEIGHT = {
        "reuters": 1.00, "bloomberg": 1.00, "financial times": 1.00,
        "wall street journal": 1.00, "cnbc": 0.90, "yahoo finance": 0.80,
        "fxstreet": 0.75, "tradingview": 0.70, "google news": 0.65, "gdelt": 0.60,
    }
    USD_BULLISH_TERMS = (
        "hawkish fed", "hawkish federal reserve", "higher for longer",
        "rate hike bets rise", "rate hike expectations rise", "fed tightening",
        "strong us inflation", "hot us inflation", "sticky us inflation",
        "strong us jobs", "strong us payrolls", "strong employment",
        "strong retail sales", "strong us retail sales", "us growth accelerates",
        "robust us economy", "dollar demand increases",
    )
    USD_BEARISH_TERMS = (
        "dovish fed", "dovish federal reserve", "fed easing",
        "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade",
        "weak us inflation", "soft us inflation", "cooling us inflation",
        "weak us jobs", "weak us payrolls", "weak employment", "rising unemployment",
        "jobless claims rise", "higher jobless claims", "weak retail sales",
        "weak us retail sales", "us growth slows", "recession concerns", "soft economic data",
    )
    GBP_BULLISH_TERMS = (
        "hawkish boe", "hawkish bank of england", "boe rate hike", "boe hikes",
        "boe tightening", "higher boe rates", "uk inflation rises",
        "uk inflation remains elevated", "strong uk growth", "uk growth accelerates",
        "strong uk economy", "uk employment strengthens", "uk wages accelerate",
    )
    GBP_BEARISH_TERMS = (
        "dovish boe", "dovish bank of england", "boe rate cut", "boe cuts",
        "boe easing", "lower boe rates", "uk inflation falls", "cooling uk inflation",
        "weak uk growth", "uk growth slows", "uk recession concerns",
        "uk employment weakens", "uk wages slow", "unemployment rises",
        "weak labour market", "weak labor market", "soft labour market", "soft labor market",
    )
    INVERSE_DATA_TERMS = ("unemployment", "jobless claims", "claims")

    @classmethod
    def analyze(cls, events: list[dict[str, Any]], headlines: list[dict[str, Any]], markets: dict[str, Any] | None = None, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        markets = markets or {}
        usd = cls._score_currency("USD", events, headlines, markets, now)
        gbp = cls._score_currency("GBP", events, headlines, markets, now)
        pair_score = round(float(gbp["score"]) - float(usd["score"]), 2)
        pair_bias = cls._score_to_bias(pair_score, usd["evidence_count"] + gbp["evidence_count"])
        pair_conf = cls._pair_confidence(usd, gbp, pair_score)
        if usd["bias"] in {"BULLISH", "LEAN_BULLISH"} and gbp["bias"] in {"BEARISH", "LEAN_BEARISH"}:
            alignment = "USD FAVOURED"
        elif usd["bias"] in {"BEARISH", "LEAN_BEARISH"} and gbp["bias"] in {"BULLISH", "LEAN_BULLISH"}:
            alignment = "GBP FAVOURED"
        else:
            alignment = "MIXED"
        return {
            "dxy": usd,
            "gbp": gbp,
            "gbpusd": {
                "bias": pair_bias, "score": pair_score, "confidence": pair_conf,
                "reasons": cls._pair_reasons(usd, gbp),
                "bullish": pair_bias in {"BULLISH", "LEAN_BULLISH"},
                "bearish": pair_bias in {"BEARISH", "LEAN_BEARISH"},
            },
            "confidence": pair_conf,
            "alignment": alignment,
            "evidence": {
                "released_events": sum(1 for e in events if cls._is_released(e, now)),
                "upcoming_events": sum(1 for e in events if not cls._is_released(e, now)),
                "macro_headlines": len(headlines),
                "sources": sorted({str(h.get("source") or h.get("provider") or "Unknown") for h in headlines if isinstance(h, dict)}),
            },
            "summary": f"USD: {usd['bias']}. GBP: {gbp['bias']}. GBP/USD macro bias: {pair_bias}.",
        }

    @classmethod
    def _score_currency(cls, currency: str, events: list[dict[str, Any]], headlines: list[dict[str, Any]], markets: dict[str, Any], now: datetime) -> dict[str, Any]:
        score = 0.0
        reasons: list[str] = []
        evidence_count = positive = negative = 0
        for event in events:
            if str(event.get("currency", "")).upper() != currency:
                continue
            surprise = cls._event_surprise(event, now)
            if surprise is None:
                continue
            signed = surprise * cls._impact_weight(event.get("impact"))
            if signed == 0:
                continue
            score += signed; evidence_count += 1
            positive += int(signed > 0); negative += int(signed < 0)
            reasons.append(f"{event.get('title', 'Macro release')}: {'stronger' if signed > 0 else 'weaker'} than forecast ({event.get('actual')} vs {event.get('forecast')}).")
        for headline in headlines:
            if str(headline.get("currency", "")).upper() != currency:
                continue
            title = str(headline.get("title", "")).strip()
            direction = cls._headline_direction(currency, title)
            if not direction:
                continue
            signed = direction * 0.75 * cls._source_weight(headline) * cls._recency_weight(headline, now)
            score += signed; evidence_count += 1
            positive += int(signed > 0); negative += int(signed < 0)
            reasons.append(title)
        if currency == "USD" and evidence_count:
            yield_move = cls._market_change(markets.get("US10Y"))
            if yield_move is not None and yield_move != 0:
                signed = 0.35 if yield_move > 0 else -0.35
                score += signed
                reasons.append("U.S. 10Y yield move is supportive of USD." if signed > 0 else "U.S. 10Y yield move is a USD headwind.")
        score = max(-5.0, min(5.0, score))
        bias = cls._score_to_bias(score, evidence_count)
        confidence = cls._confidence(score, evidence_count, positive, negative)
        return {"bias": bias, "score": round(score, 2), "confidence": confidence, "reasons": list(dict.fromkeys(reasons))[:5], "evidence_count": evidence_count, "bullish": bias in {"BULLISH", "LEAN_BULLISH"}, "bearish": bias in {"BEARISH", "LEAN_BEARISH"}}

    @classmethod
    def _event_surprise(cls, event: dict[str, Any], now: datetime) -> float | None:
        if not cls._is_released(event, now):
            return None
        actual = cls._number(event.get("actual")); forecast = cls._number(event.get("forecast"))
        if actual is None or forecast is None:
            return None
        delta = actual - forecast
        if abs(delta) < 1e-12:
            return 0.0
        title = str(event.get("title", "")).lower()
        sign = 1 if delta > 0 else -1
        if any(term in title for term in cls.INVERSE_DATA_TERMS):
            sign *= -1
        return float(sign)

    @staticmethod
    def _is_released(event: dict[str, Any], now: datetime) -> bool:
        try:
            dt = event.get("time") if isinstance(event.get("time"), datetime) else datetime.fromisoformat(str(event.get("time")).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt <= now
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _number(value: Any) -> float | None:
        if value is None:
            return None
        text = str(value).strip().upper().replace(",", "")
        if text in {"", "—", "-", "N/A", "NA", "NONE"}:
            return None
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        if not match:
            return None
        try:
            number = float(match.group(0))
            if text.endswith("K"): number *= 1e3
            elif text.endswith("M"): number *= 1e6
            elif text.endswith("B"): number *= 1e9
            return number
        except ValueError:
            return None

    @classmethod
    def _headline_direction(cls, currency: str, title: str) -> int:
        text = title.lower()
        positive = cls.USD_BULLISH_TERMS if currency == "USD" else cls.GBP_BULLISH_TERMS
        negative = cls.USD_BEARISH_TERMS if currency == "USD" else cls.GBP_BEARISH_TERMS
        pos = sum(term in text for term in positive); neg = sum(term in text for term in negative)
        if pos and neg: return 0
        return 1 if pos else -1 if neg else 0

    @staticmethod
    def _impact_weight(value: Any) -> float:
        text = str(value or "").upper()
        if "HIGH" in text: return 1.0
        if "MEDIUM" in text: return 0.7
        return 0.4

    @classmethod
    def _source_weight(cls, headline: dict[str, Any]) -> float:
        text = str(headline.get("source") or headline.get("provider") or "").lower()
        for key, weight in cls.SOURCE_WEIGHT.items():
            if key in text: return weight
        return 0.60

    @staticmethod
    def _recency_weight(headline: dict[str, Any], now: datetime) -> float:
        value = headline.get("published_at") or headline.get("published")
        if not value: return 0.65
        try:
            dt = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
            age = max(0.0, (now - dt.astimezone(timezone.utc)).total_seconds() / 3600)
            return 1.0 if age <= 3 else 0.85 if age <= 12 else 0.65 if age <= 24 else 0.45
        except (TypeError, ValueError):
            return 0.65

    @staticmethod
    def _market_change(quote: Any) -> float | None:
        if not isinstance(quote, dict): return None
        for key in ("change_percent", "right_now_momentum_percent"):
            try:
                value = float(quote.get(key));
                if value == value: return value
            except (TypeError, ValueError):
                pass
        return None

    @staticmethod
    def _score_to_bias(score: float, evidence_count: int) -> str:
        if evidence_count == 0: return "UNKNOWN"
        if score >= 2.0: return "BULLISH"
        if score <= -2.0: return "BEARISH"
        if score >= 0.75: return "LEAN_BULLISH"
        if score <= -0.75: return "LEAN_BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _confidence(score: float, evidence_count: int, positive: int, negative: int) -> int:
        if evidence_count == 0: return 0
        value = min(100, int(abs(score) / 2.5 * 100))
        if evidence_count >= 2: value += 8
        if evidence_count >= 4: value += 7
        if positive and negative: value -= 18
        return max(0, min(100, value))

    @staticmethod
    def _pair_confidence(usd: dict[str, Any], gbp: dict[str, Any], score: float) -> int:
        direct = int(min(100, abs(score) / 2.5 * 100))
        evidence = int((usd.get("confidence", 0) + gbp.get("confidence", 0)) / 2)
        if usd.get("bias") == "UNKNOWN" or gbp.get("bias") == "UNKNOWN":
            return int(direct * 0.65)
        return int((direct + evidence) / 2)

    @staticmethod
    def _pair_reasons(usd: dict[str, Any], gbp: dict[str, Any]) -> list[str]:
        reasons = []
        if usd.get("bias") in {"BULLISH", "LEAN_BULLISH"}: reasons.append("USD evidence is supportive of downside in GBP/USD.")
        elif usd.get("bias") in {"BEARISH", "LEAN_BEARISH"}: reasons.append("USD evidence is supportive of upside in GBP/USD.")
        if gbp.get("bias") in {"BULLISH", "LEAN_BULLISH"}: reasons.append("GBP evidence is supportive of GBP/USD.")
        elif gbp.get("bias") in {"BEARISH", "LEAN_BEARISH"}: reasons.append("GBP evidence is a headwind for GBP/USD.")
        if not reasons: reasons.append("Current fundamental evidence is mixed or insufficient for a strong GBP/USD direction.")
        return reasons
