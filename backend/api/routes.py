from datetime import datetime, timezone

from fastapi import APIRouter

from services.pal_service import PALService
from providers.economic_calendar_provider import EconomicCalendarProvider
from providers.official_calendar_provider import OfficialCalendarProvider


router = APIRouter(
    prefix="/pal",
    tags=["PAL Trading Buddy"],
)


service = PALService()
economic_calendar = EconomicCalendarProvider()
official_calendar = OfficialCalendarProvider()


@router.get("/analyze/{symbol}")
def analyze(symbol: str):
    symbol = symbol.upper()
    current_time = datetime.now(timezone.utc)

    # Primary calendar: existing provider with actual/forecast/previous values.
    # Fallback: official-source release schedules. The fallback intentionally
    # leaves actual/forecast/previous as null rather than inventing them.
    try:
        news_events = economic_calendar.get_events()
    except Exception as ex:
        print(f"Economic calendar provider failed: {ex}")
        news_events = []

    if not news_events:
        try:
            news_events = official_calendar.get_events()
        except Exception as ex:
            print(f"Official calendar fallback failed: {ex}")
            news_events = []

    report = service.analyze(
        symbol=symbol,
        news_events=news_events,
        current_time=current_time,
    )

    return {
        "success": True,
        "symbol": symbol,
        "timestamp": current_time.isoformat(),
        "report": report,
    }
