from datetime import datetime, timezone

from fastapi import APIRouter

from services.pal_service import PALService
from providers.economic_calendar_provider import (
    EconomicCalendarProvider,
)


router = APIRouter(
    prefix="/pal",
    tags=["PAL Trading Buddy"],
)


service = PALService()

economic_calendar = EconomicCalendarProvider()


@router.get("/analyze/{symbol}")
def analyze(symbol: str):

    symbol = symbol.upper()

    # ==========================================================
    # CURRENT UTC TIME
    # ==========================================================

    current_time = datetime.now(
        timezone.utc
    )

    # ==========================================================
    # ECONOMIC CALENDAR
    # ==========================================================
    #
    # Apify provides the macroeconomic events.
    #
    # PAL only consumes:
    # - USD events
    # - GBP events
    # - important economic releases
    #
    # No chart data is used.
    #

    try:

        news_events = (
            economic_calendar.get_events()
        )

    except Exception as ex:

        print(
            f"Economic calendar failed: {ex}"
        )

        news_events = []

    # ==========================================================
    # PAL MACRO / NEWS ANALYSIS
    # ==========================================================

    report = service.analyze(

        symbol=symbol,

        news_events=news_events,

        current_time=current_time,

    )

    # ==========================================================
    # API RESPONSE
    # ==========================================================

    return {

        "success": True,

        "symbol": symbol,

        "timestamp": (
            current_time.isoformat()
        ),

        "report": report,

    }