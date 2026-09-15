from datetime import datetime, timezone

from fastapi import APIRouter

from services.pal_service import PALService

router = APIRouter(prefix="/mobile", tags=["Mobile"])
service = PALService()


@router.get("/health")
def mobile_health():
    return {
        "success": True,
        "status": "healthy",
        "service": "PAL Trading Buddy Mobile API",
        "version": "1.3.0",
    }


@router.get("/analyze/{symbol}")
def mobile_analyze(symbol: str):
    symbol = symbol.upper()
    current_time = datetime.now(timezone.utc)
    try:
        report = service.analyze(symbol=symbol, news_events=[], current_time=current_time)
    except Exception as exc:
        return {
            "success": False,
            "symbol": symbol,
            "timestamp": current_time.isoformat(),
            "error": "PAL analysis is temporarily unavailable.",
            "detail": str(exc),
        }

    if report is None:
        return {
            "success": False,
            "symbol": symbol,
            "timestamp": current_time.isoformat(),
            "error": "PAL analysis returned no report.",
        }

    return {
        "success": True,
        "symbol": symbol,
        "timestamp": current_time.isoformat(),
        "report": report,
    }
