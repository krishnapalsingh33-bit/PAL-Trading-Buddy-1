from datetime import datetime
from typing import Any

from models.pal_report import PALReport


class ReportEngine:
    """
    PAL Macro Report Engine.

    Builds the frontend-facing macro intelligence report.

    IMPORTANT:
    This report contains macro/news information only.

    It does NOT expose:
    - trading workflow
    - execution plans
    - entry readiness
    - trade actions
    - strategy stages
    - setup instructions
    - strategy commentary
    """

    def build(
        self,
        symbol: str,
        news: dict[str, Any],
    ) -> PALReport:

        report = PALReport()

        report.symbol = symbol.upper()
        report.timestamp = datetime.utcnow().isoformat()
        report.success = True

        headlines = news.get("headlines", [])
        usd_news = news.get("usd", [])
        gbp_news = news.get("gbp", [])
        cross_news = news.get("cross", [])
        upcoming_events = news.get("upcoming_events", [])
        recent_events = news.get("recent_events", [])
        high_impact = news.get("high_impact", [])
        warnings = news.get("warnings", [])
        key_risk = news.get("key_risk", "No major scheduled macro catalyst currently identified.")
        macro_bias = news.get("macro_bias", {})
        macro_data = news.get("macro_data", {})
        markets = self._normalize_markets(news.get("markets", {}))

        dxy_bias = macro_bias.get("dxy", {})
        gbp_bias = macro_bias.get("gbp", {})
        gbpusd_bias = macro_bias.get("gbpusd", {})
        overall_confidence = macro_bias.get("confidence", 0)
        bias_summary = macro_bias.get("summary", "Macro bias is being evaluated.")

        report.news = {
            "summary": news.get("summary", "No major macro news currently identified."),
            "upcoming_events": upcoming_events,
            "recent_events": recent_events,
            "high_impact": high_impact,
            "warnings": warnings,
            "key_risk": key_risk,
            "headlines": headlines,
            "usd": usd_news,
            "gbp": gbp_news,
            "cross": cross_news,
            "macro_bias": macro_bias,
            "markets": markets,
            "macro_data": macro_data,
        }

        report.macro = {
            "headline": self._build_macro_headline(news, headlines, upcoming_events),
            "summary": news.get("summary", "The latest fundamental market picture is being monitored by PAL."),
            "main_risk": key_risk,
            "confidence": overall_confidence,
            "dxy": {
                "bias": dxy_bias.get("bias", "UNKNOWN"),
                "score": dxy_bias.get("score", 0),
                "confidence": dxy_bias.get("confidence", 0),
                "reasons": dxy_bias.get("reasons", []),
                "bullish": dxy_bias.get("bias") in ["BULLISH", "LEAN_BULLISH"],
                "bearish": dxy_bias.get("bias") in ["BEARISH", "LEAN_BEARISH"],
            },
            "gbp": {
                "bias": gbp_bias.get("bias", "UNKNOWN"),
                "score": gbp_bias.get("score", 0),
                "confidence": gbp_bias.get("confidence", 0),
                "reasons": gbp_bias.get("reasons", []),
                "bullish": gbp_bias.get("bias") in ["BULLISH", "LEAN_BULLISH"],
                "bearish": gbp_bias.get("bias") in ["BEARISH", "LEAN_BEARISH"],
            },
            "gbpusd": {
                "bias": gbpusd_bias.get("bias", "UNKNOWN"),
                "score": gbpusd_bias.get("score", 0),
                "confidence": gbpusd_bias.get("confidence", 0),
                "reasons": gbpusd_bias.get("reasons", []),
                "bullish": gbpusd_bias.get("bias") in ["BULLISH", "LEAN_BULLISH"],
                "bearish": gbpusd_bias.get("bias") in ["BEARISH", "LEAN_BEARISH"],
            },
            "events": upcoming_events,
            "news": headlines,
            "usd_news": usd_news,
            "gbp_news": gbp_news,
            "cross_news": cross_news,
            "bias_summary": bias_summary,
            "markets": markets,
            "macro_data": macro_data,
        }

        # Explicit feed health for the frontend. Do not make the UI infer
        # connectivity from unrelated macro-bias fields.
        report.market_health = self._market_health(markets)

        report.execution = {}
        report.ai_commentary = {}

        report.summary = {
            "market": {
                "symbol": symbol.upper(),
                "bias": gbpusd_bias.get("bias", "UNKNOWN"),
                "health": report.market_health["status"],
            },
            "news": {
                "summary": news.get("summary", ""),
                "upcoming_events": upcoming_events,
                "key_risk": key_risk,
                "headlines": headlines,
                "usd": usd_news,
                "gbp": gbp_news,
                "cross": cross_news,
            },
            "dxy": {"trend": dxy_bias.get("bias", "UNKNOWN")},
            "macro_bias": {
                "dxy": dxy_bias,
                "gbp": gbp_bias,
                "gbpusd": gbpusd_bias,
                "confidence": overall_confidence,
                "summary": bias_summary,
            },
            "markets": markets,
            "macro_data": macro_data,
        }

        return report

    @staticmethod
    def _normalize_markets(markets: Any) -> dict[str, dict]:
        if not isinstance(markets, dict):
            return {}

        normalized: dict[str, dict] = {}
        for symbol, raw in markets.items():
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            change_percent = item.get("change_percent")
            # The frontend historically consumed change_pct/percent_change.
            # Keep the canonical backend field and provide compatibility aliases.
            item.setdefault("change_pct", change_percent)
            item.setdefault("percent_change", change_percent)
            normalized[str(symbol).upper()] = item
        return normalized

    @staticmethod
    def _market_health(markets: dict[str, dict]) -> dict[str, Any]:
        if not markets:
            return {
                "status": "UNAVAILABLE",
                "score": 0,
                "summary": "No market quotes were returned by the live provider.",
            }

        statuses = [str(item.get("status", "UNAVAILABLE")).upper() for item in markets.values()]
        live_count = sum(status in {"CURRENT", "RECENT"} for status in statuses)
        stale_count = sum(status == "STALE" for status in statuses)

        if live_count:
            score = round(live_count / len(statuses) * 100)
            status = "LIVE" if live_count == len(statuses) else "PARTIAL"
            summary = f"{live_count}/{len(statuses)} market feeds are live or recent."
        elif stale_count:
            score = round(stale_count / len(statuses) * 100)
            status = "STALE"
            summary = f"All live market requests failed; {stale_count}/{len(statuses)} feeds have stale cached data."
        else:
            score = 0
            status = "UNAVAILABLE"
            summary = "The live market provider returned no usable quotes."

        return {
            "status": status,
            "score": score,
            "summary": summary,
        }

    @staticmethod
    def _build_macro_headline(news: dict[str, Any], headlines: list[dict], upcoming_events: list[dict]) -> str:
        if upcoming_events:
            first = upcoming_events[0]
            minutes = first.get("minutes")
            title = first.get("title", "Major macro event")
            if isinstance(minutes, int) and minutes <= 60:
                return f"{title} is the next major macro catalyst."

        for headline in headlines:
            if headline.get("impact") == "High":
                return "Major macro news is currently driving attention."

        if headlines:
            return "Recent USD and GBP macro developments are being monitored."

        return "Macro conditions are being monitored."
