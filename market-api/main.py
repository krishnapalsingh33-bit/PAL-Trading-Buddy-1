from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from threading import Lock, Thread
from time import monotonic
from typing import Any
from pathlib import Path

import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
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

# Keep the HTTP quote endpoint fast: quote providers refresh in the background.
_LATEST_QUOTES: dict[str, dict[str, Any]] = {}
_QUOTE_STATE_LOCK = Lock()
_REFRESHING_QUOTES = False
_LAST_REFRESH_STARTED = 0.0
_LAST_REFRESH_FINISHED: str | None = None
_LAST_REFRESH_ERROR: str | None = None
_REFRESH_COOLDOWN_SECONDS = 8.0


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


def _refresh_quote_worker() -> None:
    """Refresh all provider quotes without blocking the API request that started it."""
    global _REFRESHING_QUOTES, _LAST_REFRESH_FINISHED, _LAST_REFRESH_ERROR
    errors: list[str] = []
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {pool.submit(fetch_one, key): key for key in SYMBOLS}
            for future in as_completed(futures):
                key = futures[future]
                try:
                    quote = future.result()
                except Exception as exc:
                    quote = unavailable(key, f"Unexpected quote worker error: {type(exc).__name__}")
                with _QUOTE_STATE_LOCK:
                    previous = _LATEST_QUOTES.get(key)
                    # Preserve the last usable price if the provider refresh fails;
                    # its original timestamp stays intact and is re-evaluated below.
                    if quote.get("price") is None and previous and previous.get("price") is not None:
                        retained = dict(previous)
                        retained["refresh_error"] = quote.get("reason")
                        _LATEST_QUOTES[key] = retained
                        errors.append(f"{key}: {quote.get('reason') or 'provider unavailable'}")
                    else:
                        _LATEST_QUOTES[key] = dict(quote)
                        if quote.get("price") is None:
                            errors.append(f"{key}: {quote.get('reason') or 'provider unavailable'}")
        with _QUOTE_STATE_LOCK:
            _LAST_REFRESH_ERROR = "; ".join(errors)[:900] if errors else None
            _LAST_REFRESH_FINISHED = utc_now().isoformat()
    except Exception as exc:
        with _QUOTE_STATE_LOCK:
            _LAST_REFRESH_ERROR = f"{type(exc).__name__}: {str(exc)[:180]}"
            _LAST_REFRESH_FINISHED = utc_now().isoformat()
    finally:
        with _QUOTE_STATE_LOCK:
            _REFRESHING_QUOTES = False


def _queue_quote_refresh() -> None:
    """Start at most one provider refresh and return immediately to the caller."""
    global _REFRESHING_QUOTES, _LAST_REFRESH_STARTED, _LAST_REFRESH_ERROR
    now = monotonic()
    with _QUOTE_STATE_LOCK:
        if _REFRESHING_QUOTES:
            return
        if _LAST_REFRESH_STARTED and now - _LAST_REFRESH_STARTED < _REFRESH_COOLDOWN_SECONDS:
            return
        _REFRESHING_QUOTES = True
        _LAST_REFRESH_STARTED = now
        _LAST_REFRESH_ERROR = None
        worker = Thread(target=_refresh_quote_worker, name="pal-quote-refresh", daemon=True)
        worker.start()


PAL_ANALYSIS_API_BASE = "https://pal-trading-buddy-1.onrender.com"
PAL_ANALYSIS_TIMEOUT = (3.0, 65.0)

def _proxy_pal_json(path: str, timeout: tuple[float, float] = (3.0, 15.0)) -> dict[str, Any]:
    """Call the original PAL service server-to-server to avoid browser CORS failures."""
    try:
        response = requests.get(
            PAL_ANALYSIS_API_BASE + path,
            headers={"Accept": "application/json", "User-Agent": "PAL-Market-Dashboard/1.0"},
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("PAL service returned a non-object JSON response.")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"PAL upstream request failed for {path}: {type(exc).__name__}: {str(exc)[:180]}",
        ) from exc

@app.get("/", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
def root() -> FileResponse:
    """Serve the live dashboard from the same origin as its quote APIs."""
    return FileResponse(Path(__file__).with_name("dashboard.html"), media_type="text/html")

@app.get("/download/mobile", include_in_schema=False)
def download_mobile_dashboard() -> FileResponse:
    """Download the portable HTML dashboard for phone or laptop browsers."""
    return FileResponse(
        Path(__file__).with_name("PAL-Trading-Buddy-Mobile.html"),
        media_type="text/html",
        filename="PAL-Trading-Buddy-Mobile.html",
    )


@app.get("/manifest.webmanifest", include_in_schema=False)
def web_manifest() -> FileResponse:
    return FileResponse(
        Path(__file__).with_name("manifest.webmanifest"),
        media_type="application/manifest+json",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/service-worker.js", include_in_schema=False)
def service_worker() -> FileResponse:
    return FileResponse(
        Path(__file__).with_name("service-worker.js"),
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"},
    )


@app.get("/app-icon.svg", include_in_schema=False)
def app_icon() -> FileResponse:
    return FileResponse(
        Path(__file__).with_name("app-icon.svg"),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "market-data-api",
        "commit": os.environ.get("RENDER_GIT_COMMIT", "unknown"),
    }


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


@app.get("/pal/analysis-status")
def analysis_status() -> dict[str, Any]:
    """Check analysis and provider status concurrently; this must stay lightweight."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        health_future = pool.submit(_proxy_pal_json, "/health", (2.0, 5.0))
        provider_future = pool.submit(_proxy_pal_json, "/pal/provider-status", (2.0, 6.0))
        try:
            health_payload = health_future.result(timeout=7.0)
            provider_payload = provider_future.result(timeout=7.0)
        except Exception as exc:
            return {
                "success": False,
                "reachable": False,
                "checked_at": utc_now().isoformat(),
                "error": f"PAL analysis status unavailable: {type(exc).__name__}: {str(exc)[:160]}",
                "provider_status": None,
            }
    healthy = str(health_payload.get("status", "")).lower() == "healthy"
    return {
        "success": healthy and bool(provider_payload.get("success", True)),
        "reachable": healthy,
        "checked_at": utc_now().isoformat(),
        "backend_health": health_payload,
        "provider_status": provider_payload,
    }


@app.get("/pal/analysis/{symbol}")
def proxy_analysis(symbol: str) -> dict[str, Any]:
    """Proxy selected PAL analysis symbols server-side; never accept arbitrary URLs."""
    normalized = symbol.upper()
    if normalized not in {"GBPUSD", "DXY", "XAUUSD", "BTCUSD"}:
        raise HTTPException(status_code=400, detail="Unsupported analysis symbol.")
    return _proxy_pal_json("/pal/analyze/" + normalized, timeout=PAL_ANALYSIS_TIMEOUT)

@app.get("/pal/news")
def proxy_news() -> dict[str, Any]:
    """Proxy the PAL news endpoint to keep browser calls same-origin."""
    return _proxy_pal_json("/v2/news", timeout=(3.0, 25.0))

@app.get("/pal/markets")
def market_snapshot() -> dict[str, Any]:
    """Return immediately; provider refresh is served stale-while-revalidate."""
    _queue_quote_refresh()
    with _QUOTE_STATE_LOCK:
        quotes = {key: dict(_LATEST_QUOTES[key]) for key in _LATEST_QUOTES}
        refreshing = _REFRESHING_QUOTES
        refresh_started = _LAST_REFRESH_STARTED
        refresh_finished = _LAST_REFRESH_FINISHED
        refresh_error = _LAST_REFRESH_ERROR

    for key, quote in quotes.items():
        quote_status, age = freshness(quote.get("timestamp"))
        quote["status"] = quote_status
        quote["freshness_seconds"] = age
        if quote_status == "STALE":
            quote["reason"] = "Last provider timestamp is stale; do not treat this as a live quote."
        elif quote_status == "UNAVAILABLE" and quote.get("price") is not None:
            quote["reason"] = "The provider did not return a usable timestamp; freshness cannot be verified."

    if not quotes:
        quotes = {
            key: unavailable(key, "Initial provider refresh is running in the background; check again in a few seconds.")
            for key in SYMBOLS
        }

    # Keep the full four-symbol schema stable while the first fetch is running.
    for key in SYMBOLS:
        quotes.setdefault(key, unavailable(key, "No quote received yet; provider refresh is running in the background."))

    usable = sum(1 for q in quotes.values() if q.get("price") is not None and q.get("status") in {"CURRENT", "RECENT"})
    fresh = sum(1 for q in quotes.values() if q.get("price") is not None and q.get("status") == "CURRENT")
    if refreshing and usable < len(SYMBOLS):
        status = "REFRESHING"
    elif usable == 4 and fresh == 4:
        status = "CONNECTED"
    elif usable == 4:
        status = "CONNECTED_WITH_RECENT_QUOTES"
    elif usable:
        status = "PARTIAL"
    else:
        status = "UNAVAILABLE" if not refreshing else "REFRESHING"

    started_at = (
        datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + (refresh_started - monotonic()),
            timezone.utc,
        ).isoformat()
        if refresh_started
        else None
    )

    return {
        "success": True,
        "status": status,
        "timestamp": utc_now().isoformat(),
        "refreshing": refreshing,
        "refresh_started_at": started_at,
        "refresh_completed_at": refresh_finished,
        "refresh_error": refresh_error,
        "provider": {
            "name": "Yahoo Finance chart API",
            "configured": True,
            "status": "REFRESHING" if refreshing else "RESPONDING" if usable else "NO_USABLE_QUOTES",
            "fresh_quotes": fresh,
            "usable_quotes": usable,
            "expected_quotes": 4,
            "refreshing": refreshing,
            "last_refresh_started": started_at,
            "last_refresh_completed": refresh_finished,
            "last_refresh_error": refresh_error,
        },
        "markets": quotes,
    }

