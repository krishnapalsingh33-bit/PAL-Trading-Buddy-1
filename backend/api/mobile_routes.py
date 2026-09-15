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
        "version": "1.1.0",
    }


@router.get("/analyze/{symbol}")
def mobile_analyze(symbol: str):
    """Mobile-compatible PAL analysis endpoint.

    Reuses the existing PAL analysis pipeline, including live market
    observation, macro/news intelligence and structured fallback behavior.
    """
    symbol = symbol.upper()
    current_time = datetime.now(timezone.utc)
    report = service.analyze(symbol=symbol, news_events=[], current_time=current_time)
    return {
        "success": True,
        "symbol": symbol,
        "timestamp": current_time.isoformat(),
        "report": report,
    }
