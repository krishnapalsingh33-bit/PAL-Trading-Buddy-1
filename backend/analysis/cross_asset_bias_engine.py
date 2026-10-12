from __future__ import annotations

from typing import Any


class CrossAssetBiasEngine:
    """Transparent rule-based cross-asset bias for Gold and Bitcoin.

    This is an explainable scoring layer, not a trained FinBERT model. It combines
    daily price change, short-term momentum, and available dollar/yield context.
    """

    @staticmethod
    def _num(value: Any) -> float | None:
        try:
            number = float(value)
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    @classmethod
    def _quote(cls, markets: dict[str, Any], key: str) -> dict[str, Any]:
        value = markets.get(key, {})
        return value if isinstance(value, dict) else {}

    @classmethod
    def _score_asset(cls, symbol: str, markets: dict[str, Any]) -> dict[str, Any]:
        q = cls._quote(markets, symbol)
        dxy = cls._quote(markets, "DXY")
        yields = cls._quote(markets, "US10Y")
        daily = cls._num(q.get("change_percent"))
        momentum = cls._num(q.get("right_now_momentum_percent"))
        dxy_change = cls._num(dxy.get("change_percent"))
        yield_change = cls._num(yields.get("change_percent"))

        components: list[tuple[str, float, float]] = []
        reasons: list[str] = []
        if daily is None and momentum is None:
            return {
                "bias": "UNKNOWN", "confidence": 0, "score": 0.0,
                "reasons": ["No usable daily price change or short-term momentum for this asset."],
                "evidence_count": 0, "scope": "TODAY_CROSS_ASSET",
                "status": "INSUFFICIENT_DATA", "components": {},
            }
        if daily is not None:
            components.append(("daily_price", max(-1.0, min(1.0, daily / 1.0)), 0.45 if symbol == "BTCUSD" else 0.40))
            reasons.append(f"Daily price change {daily:+.2f}%.")
        if momentum is not None:
            components.append(("short_term_momentum", max(-1.0, min(1.0, momentum / 0.15)), 0.30))
            reasons.append(f"Latest short-term momentum {momentum:+.3f}%.")
        if dxy_change is not None:
            # A stronger dollar is commonly a headwind for gold and risk assets, but is not deterministic.
            components.append(("inverse_dollar_context", max(-1.0, min(1.0, -dxy_change / 0.50)), 0.20))
            reasons.append(f"DXY context {dxy_change:+.2f}% (inverse cross-asset input).")
        if symbol == "XAUUSD" and yield_change is not None:
            components.append(("inverse_yield_context", max(-1.0, min(1.0, -yield_change / 1.0)), 0.10))
            reasons.append(f"US 10Y yield change {yield_change:+.2f}% (supporting context).")

        total_weight = sum(weight for _, _, weight in components)
        if not components or total_weight <= 0:
            return {
                "bias": "UNKNOWN", "confidence": 0, "score": 0.0,
                "reasons": ["Insufficient current quote or cross-asset data."],
                "evidence_count": 0, "scope": "TODAY_CROSS_ASSET",
                "status": "INSUFFICIENT_DATA", "components": {},
            }

        score = sum(value * weight for _, value, weight in components) / total_weight
        if score >= 0.12:
            bias = "BULLISH"
        elif score <= -0.12:
            bias = "BEARISH"
        else:
            bias = "NEUTRAL"
        directional_strength = min(1.0, abs(score))
        coverage = min(1.0, len(components) / 3.0)
        confidence = round(min(90, 25 + directional_strength * 40 + coverage * 25))
        return {
            "bias": bias, "confidence": confidence, "score": round(score, 3),
            "reasons": reasons[:4], "evidence_count": len(components),
            "scope": "TODAY_CROSS_ASSET", "confidence_type": "EVIDENCE_STRENGTH_NOT_WIN_PROBABILITY", "status": "CURRENT" if q.get("price") is not None and (daily is not None or momentum is not None) else "PARTIAL",
            "components": {name: round(value, 3) for name, value, _ in components},
        }

    @classmethod
    def analyze(cls, markets: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return {
            "gold": cls._score_asset("XAUUSD", markets),
            "btcusd": cls._score_asset("BTCUSD", markets),
        }
