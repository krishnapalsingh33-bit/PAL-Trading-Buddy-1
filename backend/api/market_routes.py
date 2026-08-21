from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from services.forex_intelligence_service import ForexIntelligenceService
from services.pal_service import PALService

router = APIRouter(prefix="/v2/market", tags=["Market Intelligence"])

forex_service = ForexIntelligenceService()
pal_service = PALService()


@router.get("/forex/pairs")
def forex_pairs():
    pairs = []
    for symbol in ForexIntelligenceService.SUPPORTED:
        normalized = ForexIntelligenceService.normalize(symbol)
        pairs.append(
            {
                "symbol": normalized,
                "label": ForexIntelligenceService.display_label(normalized),
                "base_currency": normalized[:3],
                "quote_currency": normalized[3:],
            }
        )
    pairs.sort(key=lambda item: item["label"])
    return {"success": True, "count": len(pairs), "pairs": pairs}


@router.get("/forex/{symbol}")
def forex_intelligence(symbol: str):
    try:
        technical = forex_service.analyze(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Forex market data unavailable: {exc}") from exc

    base_currency, quote_currency = forex_service.currencies(symbol)
    try:
        report = pal_service.analyze(
            symbol=technical["symbol"],
            news_events=[],
            current_time=datetime.now(timezone.utc),
        )
        news_payload = report.news if hasattr(report, "news") else {}
        upcoming_events = list(news_payload.get("upcoming_events") or [])
        headlines = list(news_payload.get("headlines") or [])
        currencies = {base_currency, quote_currency}
        upcoming_events = [event for event in upcoming_events if str(event.get("currency", "")).upper() in currencies]
        headlines = [article for article in headlines if not article.get("currency") or str(article.get("currency")).upper() in currencies]
    except Exception:
        upcoming_events, headlines = [], []

    return {
        "success": True,
        "symbol": technical["symbol"],
        "label": technical["label"],
        "technical": technical,
        "news": {
            "currencies": [base_currency, quote_currency],
            "upcoming_events": upcoming_events,
            "headlines": headlines,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
