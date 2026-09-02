from datetime import datetime, timezone
import re

from fastapi import APIRouter

from services.pal_service import PALService
from providers.economic_calendar_provider import EconomicCalendarProvider
from providers.forex_factory_provider import ForexFactoryProvider
from providers.official_calendar_provider import OfficialCalendarProvider


router = APIRouter(
    prefix="/pal",
    tags=["PAL Trading Buddy"],
)


service = PALService()
economic_calendar = EconomicCalendarProvider()
forex_factory = ForexFactoryProvider()
official_calendar = OfficialCalendarProvider()


def _parse_time(value):
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _event_key(event: dict):
    title = re.sub(r"[^a-z0-9]+", " ", str(event.get("title", "")).lower()).strip()
    currency = str(event.get("currency", "")).upper()
    dt = _parse_time(event.get("time"))
    stamp = dt.strftime("%Y-%m-%dT%H:%M") if dt else str(event.get("time", ""))
    return currency, stamp, title


def _has_result_values(event: dict) -> bool:
    return any(
        event.get(key) not in (None, "", "—", "-", "N/A", "NA")
        for key in ("actual", "forecast", "previous")
    )


def _merge_event_sources(primary: list[dict], secondary: list[dict], official: list[dict]) -> tuple[list[dict], list[str]]:
    merged: dict[tuple, dict] = {}
    source_priority = {
        "Apify": 3,
        "Forex Factory": 2,
        "BLS": 1,
        "Federal Reserve": 1,
        "UK Office for National Statistics": 1,
    }
    used_sources: set[str] = set()

    for batch in (primary, secondary, official):
        for event in batch or []:
            if not isinstance(event, dict):
                continue
            key = _event_key(event)
            if not key[0] or not key[2]:
                continue
            candidate = dict(event)
            source = str(candidate.get("source") or "Unknown")
            existing = merged.get(key)
            if existing is None:
                merged[key] = candidate
                used_sources.add(source)
                continue
            candidate_score = (int(_has_result_values(candidate)), source_priority.get(source, 0))
            existing_source = str(existing.get("source") or "Unknown")
            existing_score = (int(_has_result_values(existing)), source_priority.get(existing_source, 0))
            if candidate_score > existing_score:
                merged[key] = candidate
                used_sources.add(source)
            else:
                used_sources.add(existing_source)

    events = list(merged.values())
    events.sort(key=lambda event: _parse_time(event.get("time")) or datetime.max.replace(tzinfo=timezone.utc))
    return events, sorted(used_sources)


@router.get("/analyze/{symbol}")
def analyze(symbol: str):
    symbol = symbol.upper()
    current_time = datetime.now(timezone.utc)

    # Calendar hierarchy:
    # 1) Apify calendar when configured
    # 2) Forex Factory feed as a rich free fallback
    # 3) official BLS/Fed/ONS schedules for coverage
    try:
        apify_events = economic_calendar.get_events()
    except Exception as ex:
        print(f"Economic calendar provider failed: {ex}")
        apify_events = []

    try:
        forex_factory_events = forex_factory.get_events()
    except Exception as ex:
        print(f"Forex Factory provider failed: {ex}")
        forex_factory_events = []

    try:
        official_events = official_calendar.get_events(days_before=1, days_after=30)
    except Exception as ex:
        print(f"Official calendar provider failed: {ex}")
        official_events = []

    merged_events, calendar_sources = _merge_event_sources(
        apify_events,
        forex_factory_events,
        official_events,
    )

    report = service.analyze(
        symbol=symbol,
        news_events=merged_events,
        current_time=current_time,
    )

    # Do NOT overwrite rich actual/forecast/previous data with the official
    # schedule. NewsEngine already separates upcoming and recently released
    # events while preserving those fields.
    report.news["calendar_sources"] = calendar_sources
    report.news["calendar_counts"] = {
        "apify": len(apify_events),
        "forex_factory": len(forex_factory_events),
        "official": len(official_events),
        "merged": len(merged_events),
    }
    report.summary.setdefault("news", {})["calendar_sources"] = calendar_sources
    report.summary.setdefault("news", {})["calendar_counts"] = report.news["calendar_counts"]
    report.macro["calendar_sources"] = calendar_sources

    return {
        "success": True,
        "symbol": symbol,
        "timestamp": current_time.isoformat(),
        "report": report,
    }
