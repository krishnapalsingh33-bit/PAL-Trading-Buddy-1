from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from threading import Lock
from time import monotonic
from typing import Any

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PAL Read-only Market Data API",
    version="1.0.0",
    description="Public market quotes only. No journals, user accounts, or personal data.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

SYMBOLS = {
    "DXY": {"provider_symbol": "DX-Y.NYB", "label": "US Dollar Index", "kind": "index"},
    "XAUUSD": {"provider_symbol": "GC=F", "label": "Gold futures proxy", "kind": "futures_proxy"},
    "BTCUSD": {"provider_symbol": "BTC-USD", "label": "Bitcoin / US Dollar", "kind": "crypto"},
    "GBPUSD": {"provider_symbol": "GBPUSD=X", "label": "British Pound / US Dollar", "kind": "fx"},
}
YAHOO_CHART_ENDPOINTS = (
    "https://query1.finance.yahoo.com/v8/finance/chart/",
    "https://query2.finance.yahoo.com/v8/finance/chart/",
)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://finance.yahoo.com/",
}
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_LOCK = Lock()
_CACHE_SECONDS = 12


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_from_unix(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(int(value), timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def freshness(timestamp: str | None) -> tuple[str, int | None]:
    if not timestamp:
        return "UNAVAILABLE", None
    try:
        observed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=timezone.utc)
        age = max(0, int((utc_now() - observed.astimezone(timezone.utc)).total_seconds()))
    except (TypeError, ValueError):
        return "UNAVAILABLE", None
    if age <= 300:
        return "CURRENT", age
    if age <= 86400:
        return "RECENT", age
    return "STALE", age


def unavailable(key: str, reason: str) -> dict[str, Any]:
    item = SYMBOLS[key]
    return {
        "symbol": key,
        "provider_symbol": item["provider_symbol"],
        "label": item["label"],
        "kind": item["kind"],
        "price": None,
        "previous_price": None,
        "change": None,
        "change_percent": None,
        "timestamp": None,
        "source": "Yahoo Finance",
        "status": "UNAVAILABLE",
        "freshness_seconds": None,
        "reason": reason,
    }


def fetch_one(key: str) -> dict[str, Any]:
    now = monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and now - cached[0] <= _CACHE_SECONDS:
            return dict(cached[1])

    provider_symbol = SYMBOLS[key]["provider_symbol"]
    last_error = "No response received."
    for base in YAHOO_CHART_ENDPOINTS:
        try:
            response = requests.get(
                base + provider_symbol,
                params={
                    "range": "1d",
                    "interval": "1m",
                    "includePrePost": "true",
                    "events": "history",
                    "lang": "en-US",
                    "region": "US",
                },
                headers=HEADERS,
                timeout=(2.0, 4.0),
            )
            response.raise_for_status()
            payload = response.json()
            chart = payload.get("chart") or {}
            if chart.get("error"):
                err = chart["error"]
                raise RuntimeError(str(err.get("description") or err.get("code") or "Yahoo chart error"))

            results = chart.get("result") or []
            if not results:
                raise RuntimeError("Yahoo returned no chart result.")

            result = results[0]
            meta = result.get("meta") or {}
            price = meta.get("regularMarketPrice")
            timestamps = result.get("timestamp") or []
            if price is None:
                quote_rows = ((result.get("indicators") or {}).get("quote") or [{}])
                closes = (quote_rows[0] or {}).get("close") or []
                for candidate in reversed(closes):
                    if candidate is not None:
                        price = candidate
                        break
            if price is None:
                raise RuntimeError("Yahoo response contained no market price.")

            stamp = timestamp_from_unix(meta.get("regularMarketTime"))
            if not stamp and timestamps:
                stamp = timestamp_from_unix(timestamps[-1])

            previous = meta.get("chartPreviousClose")
            if previous is None:
                previous = meta.get("previousClose")
            current = float(price)
            previous_value = float(previous) if previous is not None else None
            change = current - previous_value if previous_value not in (None, 0) else None
            change_percent = (change / previous_value * 100.0) if change is not None else None
            status, age = freshness(stamp)
            item = SYMBOLS[key]
            quote = {
                "symbol": key,
                "provider_symbol": provider_symbol,
                "label": item["label"],
                "kind": item["kind"],
                "price": current,
                "previous_price": previous_value,
                "change": change,
                "change_percent": change_percent,
                "timestamp": stamp,
                "source": "Yahoo Finance chart API",
                "status": status,
                "freshness_seconds": age,
                "reason": None if status in {"CURRENT", "RECENT"} else "Last provider timestamp is old; do not treat as a live quote.",
            }
            with _CACHE_LOCK:
                _CACHE[key] = (monotonic(), quote)
            return quote
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {str(exc)[:180]}"

    return unavailable(key, f"Quote provider failed for {provider_symbol}. {last_error}")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "PAL Read-only Market Data API",
        "status": "running",
        "scope": "public market quotes only",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "service": "market-data-api"}


@app.get("/pal/provider-status")
def provider_status() -> dict[str, Any]:
    return {
        "success": True,
        "api_status": "HEALTHY",
        "provider_name": "Yahoo Finance chart API",
        "provider_status": "ON_DEMAND",
        "quote_endpoint": "/pal/markets",
        "market_symbols": {key: value["provider_symbol"] for key, value in SYMBOLS.items()},
        "checked_at": utc_now().isoformat(),
        "scope": "quotes only; no journal or account endpoints",
    }


@app.get("/pal/markets")
def market_snapshot() -> dict[str, Any]:
    quotes: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_one, key): key for key in SYMBOLS}
        for future in as_completed(futures):
            key = futures[future]
            try:
                quotes[key] = future.result()
            except Exception as exc:
                quotes[key] = unavailable(key, f"Unexpected quote worker error: {type(exc).__name__}")

    usable = sum(1 for q in quotes.values() if q["price"] is not None and q["status"] in {"CURRENT", "RECENT"})
    fresh = sum(1 for q in quotes.values() if q["price"] is not None and q["status"] == "CURRENT")
    status = "CONNECTED" if usable == 4 and fresh == 4 else (
        "CONNECTED_WITH_RECENT_QUOTES" if usable == 4 else "PARTIAL" if usable else "UNAVAILABLE"
    )
    return {
        "success": True,
        "status": status,
        "timestamp": utc_now().isoformat(),
        "provider": {
            "name": "Yahoo Finance chart API",
            "configured": True,
            "status": "RESPONDING" if usable else "NO_USABLE_QUOTES",
            "fresh_quotes": fresh,
            "usable_quotes": usable,
            "expected_quotes": 4,
        },
        "markets": quotes,
    }
