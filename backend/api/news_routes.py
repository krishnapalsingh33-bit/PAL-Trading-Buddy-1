from fastapi import APIRouter

from providers.forex_factory_provider import (
    ForexFactoryProvider,
)


router = APIRouter(
    prefix="/v2/news",
    tags=["PAL V2 News"],
)


provider = ForexFactoryProvider()


@router.get("")
def get_news():

    try:

        events = provider.get_events()

        return {
            "success": True,
            "data": {
                "events": events,
                "total": len(events),
            },
        }

    except Exception as ex:

        return {
            "success": False,
            "data": {
                "events": [],
                "total": 0,
            },
            "error": str(ex),
        }