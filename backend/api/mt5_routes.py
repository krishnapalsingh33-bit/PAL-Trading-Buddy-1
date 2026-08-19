from fastapi import APIRouter

from services.mt5_connection_service import MT5ConnectionService


router = APIRouter(prefix="/v2/mt5", tags=["MT5"])
mt5_service = MT5ConnectionService()


@router.get("/status")
def get_mt5_status():
    return {
        "success": True,
        "data": mt5_service.status(),
    }
