from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/pal/history", tags=["PAL Market History"])

SYMBOLS = {
    "GBPUSD": "GBPUSD=X",
    "GBPJPY": "GBPJPY=X",
    "EURJPY": "EURJPY=X",
    "EURGBP": "EURGBP=X",
    "USDCAD": "CAD=X",
    "XAUUSD": "GC=F",
    "GOLD": "GC=F",
    "ETHUSD": "ETH-USD",
    "US100": "NQ=F",
    "US500": "ES=F",
    "US30": "YM=F",
}

RANGES = {
    "1D": ("1d", "5m"),
    "5D": ("5d", "30m"),
    "1M": ("1mo", "1h"),
}

@router.get("/{symbol}")
def history(symbol: str, range_: str = Query("1D", alias="range")) -> dict[str, Any]:
    ticker = SYMBOLS.get(symbol.upper(), symbol.upper())
    period, interval = RANGES.get(range_.upper(), RANGES["1D"])
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    try:
        response = requests.get(url, params={"range": period, "interval": interval, "includePrePost": "false"}, timeout=8)
        response.raise_for_status()
        payload = response.json().get("chart", {}).get("result", [])
        if not payload:
            raise ValueError("No historical chart data returned")
        result = payload[0]
        timestamps = result.get("timestamp", [])
        quote = (result.get("indicators", {}).get("quote", [{}])[0])
        points = []
        for index, timestamp in enumerate(timestamps):
            close = quote.get("close", [None] * len(timestamps))[index]
            if close is not None:
                points.append({"time": int(timestamp), "value": float(close)})
        return {"success": True, "symbol": symbol.upper(), "range": range_.upper(), "points": points}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Historical market feed unavailable: {exc}") from exc
