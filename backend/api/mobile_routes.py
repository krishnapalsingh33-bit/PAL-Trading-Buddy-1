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
        "version": "1.0.0",
    }


@router.get("/analyze/{symbol}")
def mobile_analyze(symbol: str):
    """Mobile-safe compatibility endpoint.

    It reuses PAL's existing analysis pipeline so the mobile app and
    desktop app consume the same market-intelligence logic.
    """
    from datetime import datetime, timezone

    symbol = symbol.upper()
    current_time = datetime.now(timezone.utc)

    # Mobile uses the same PAL pipeline but does not depend on the
    # calendar aggregation route during its initial connection test.
    report = service.analyze(symbol=symbol, news_events=[], current_time=current_time)
    return {
        "success": True,
        "symbol": symbol,
        "timestamp": current_time.isoformat(),
        "report": report,
    }
