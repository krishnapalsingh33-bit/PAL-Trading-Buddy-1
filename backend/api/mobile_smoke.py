from __future__ import annotations

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
        "version": "1.4.0",
    }
