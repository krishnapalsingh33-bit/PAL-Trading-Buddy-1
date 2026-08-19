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

HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}


def _fetch(ticker: str, period: str, interval: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for host in HOSTS:
        try:
            response = requests.get(
                f"https://{host}/v8/finance/chart/{ticker}",
                params={"range": period, "interval": interval, "includePrePost": "false", "events": "history"},
                headers=HEADERS,
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
            error = (payload.get("chart") or {}).get("error")
            if error:
                raise ValueError(str(error.get("description") or error))
            results = (payload.get("chart") or {}).get("result") or []
            if not results:
                raise ValueError("No historical chart data returned")
            return results[0]
        except Exception as exc:
            last_error = exc
    raise ValueError(f"All historical providers failed: {last_error}")


@router.get("/{symbol}")
def history(symbol: str, range_: str = Query("1D", alias="range")) -> dict[str, Any]:
    normalized = range_.upper()
    ticker = SYMBOLS.get(symbol.upper(), symbol.upper())
    period, interval = RANGES.get(normalized, RANGES["1D"])
    try:
        result = _fetch(ticker, period, interval)
        timestamps = result.get("timestamp", [])
        quote = (result.get("indicators", {}).get("quote", [{}])[0])
        closes = quote.get("close", [])
        points = [
            {"time": int(timestamp), "value": float(closes[index])}
            for index, timestamp in enumerate(timestamps)
            if index < len(closes) and closes[index] is not None
        ]
        return {"success": True, "symbol": symbol.upper(), "range": normalized, "points": points}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Historical market feed unavailable: {exc}") from exc
