from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

import requests

from models.market_quote import MarketQuote
from providers.market_data_provider import MarketDataProvider

logger = logging.getLogger(__name__)


class YahooMarketDataProvider(MarketDataProvider):
    """Online snapshot provider with Yahoo and CBOE fallbacks."""

    BASE_URLS = (
        "https://query1.finance.yahoo.com/v8/finance/chart",
        "https://query2.finance.yahoo.com/v8/finance/chart",
    )
    QUOTE_URLS = (
        "https://query1.finance.yahoo.com/v7/finance/quote",
        "https://query2.finance.yahoo.com/v7/finance/quote",
    )
    CBOE_URL = "https://cdn.cboe.com/api/global/delayed_quotes/quotes"
    SOURCE = "Yahoo Finance"

    SYMBOL_MAP = {
        "DXY": "DX-Y.NYB", "GBPUSD": "GBPUSD=X", "GBP/USD": "GBPUSD=X",
        "XAUUSD": "GC=F", "GOLD": "GC=F", "XAU/USD": "GC=F",
        "USOIL": "CL=F", "WTI": "CL=F", "OIL": "CL=F", "XTIUSD": "CL=F",
        "US10Y": "^TNX", "10Y": "^TNX", "TNX": "^TNX",
        "VIX": "^VIX", "VIXCLS": "^VIX",
        "US500": "^GSPC", "SPX": "^GSPC", "SP500": "^GSPC",
    }
    CBOE_SYMBOLS = {"US500": "_SPX", "SPX": "_SPX", "SP500": "_SPX", "VIX": "_VIX", "VIXCLS": "_VIX"}

    def __init__(self, timeout_seconds: float = 8.0, session: requests.Session | None = None) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
            "Accept": "application/json,text/html,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://finance.yahoo.com/",
            "Connection": "keep-alive",
        })

    @classmethod
    def yahoo_symbol(cls, symbol: str) -> str | None:
        return cls.SYMBOL_MAP.get(symbol.upper())

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            if value is None:
                return None
            number = float(value)
            return number if number == number else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _timestamp(value: Any) -> str | None:
        try:
            if value is None:
                return None
            return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
        except (TypeError, ValueError, OSError):
            return None

    @staticmethod
    def _status(timestamp: str | None) -> str:
        if not timestamp:
            return "UNAVAILABLE"
        try:
            observed = datetime.fromisoformat(timestamp)
            age_seconds = max(0, int((datetime.now(timezone.utc) - observed.astimezone(timezone.utc)).total_seconds()))
        except ValueError:
            return "UNAVAILABLE"
        if age_seconds <= 120:
            return "CURRENT"
        if age_seconds <= 86_400:
            return "RECENT"
        return "STALE"

    def _request_chart(self, yahoo_symbol: str) -> dict[str, Any]:
        last_error = None
        for base_url in self.BASE_URLS:
            try:
                response = self.session.get(
                    f"{base_url}/{yahoo_symbol}",
                    params={"range": "5d", "interval": "1d", "events": "history", "includePrePost": "true", "lang": "en-US", "region": "US"},
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
                if (payload.get("chart") or {}).get("error"):
                    raise RuntimeError((payload["chart"]["error"] or {}).get("description", "Yahoo Finance returned an error."))
                return payload
            except Exception as exc:
                last_error = exc
                logger.warning("Yahoo chart endpoint failed: %s (%s)", base_url, exc)
        raise RuntimeError(f"All Yahoo chart endpoints failed: {last_error}")

    def _request_quote(self, yahoo_symbol: str) -> dict[str, Any]:
        last_error = None
        for base_url in self.QUOTE_URLS:
            try:
                response = self.session.get(base_url, params={"symbols": yahoo_symbol}, timeout=self.timeout_seconds)
                response.raise_for_status()
                results = ((response.json().get("quoteResponse") or {}).get("result") or [])
                if results:
                    return results[0]
                raise RuntimeError("Yahoo quote endpoint returned no result.")
            except Exception as exc:
                last_error = exc
                logger.warning("Yahoo quote endpoint failed: %s (%s)", base_url, exc)
        raise RuntimeError(f"All Yahoo quote endpoints failed: {last_error}")

    def _request_quote_page(self, yahoo_symbol: str) -> dict[str, Any]:
        response = self.session.get(f"https://finance.yahoo.com/quote/{yahoo_symbol}/", timeout=self.timeout_seconds)
        response.raise_for_status()
        html = response.text
        price = None
        for pattern in (r'"regularMarketPrice"\s*:\s*\{"raw"\s*:\s*([0-9.\-]+)', r'"regularMarketPrice"\s*:\s*([0-9.\-]+)'):
            match = re.search(pattern, html)
            if match:
                price = self._number(match.group(1))
                if price is not None:
                    break
        if price is None:
            raise RuntimeError("Yahoo Finance page contained no regularMarketPrice.")
        previous = None
        for pattern in (r'"regularMarketPreviousClose"\s*:\s*\{"raw"\s*:\s*([0-9.\-]+)', r'"regularMarketPreviousClose"\s*:\s*([0-9.\-]+)'):
            match = re.search(pattern, html)
            if match:
                previous = self._number(match.group(1))
                if previous is not None:
                    break
        timestamp = None
        match = re.search(r'"regularMarketTime"\s*:\s*([0-9]+)', html)
        if match:
            timestamp = self._timestamp(match.group(1))
        return {"regularMarketPrice": price, "regularMarketPreviousClose": previous, "regularMarketTime": timestamp}

    def _request_cboe(self, cboe_symbol: str) -> dict[str, Any]:
        response = self.session.get(f"{self.CBOE_URL}/{cboe_symbol}.json", timeout=self.timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise RuntimeError("CBOE returned no quote data.")
        return data

    def _quote_from_cboe(self, normalized: str) -> MarketQuote:
        data = self._request_cboe(self.CBOE_SYMBOLS[normalized])
        price = self._number(data.get("current_price") or data.get("last_price") or data.get("last"))
        previous = self._number(data.get("prev_day_close") or data.get("previous_close") or data.get("prev"))
        timestamp_text = data.get("last_trade_time") or data.get("timestamp")
        market_time = None
        if isinstance(timestamp_text, str):
            try:
                market_time = datetime.fromisoformat(timestamp_text.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
            except ValueError:
                pass
        if price is None:
            raise RuntimeError("CBOE returned no current price.")
        return self._build_quote(normalized, price, previous, market_time, source="Cboe Global Markets")

    def _quote_from_chart(self, normalized: str, yahoo_symbol: str) -> MarketQuote:
        result = ((self._request_chart(yahoo_symbol).get("chart") or {}).get("result") or [])
        if not result:
            raise RuntimeError("Yahoo Finance returned no quote data.")
        meta = result[0].get("meta") or {}
        price = self._number(meta.get("regularMarketPrice") or meta.get("postMarketPrice") or meta.get("preMarketPrice"))
        previous = self._number(meta.get("previousClose") or meta.get("chartPreviousClose"))
        timestamps = result[0].get("timestamp") or []
        closes = (((result[0].get("indicators") or {}).get("quote") or [{}])[0]).get("close", [])
        if price is None:
            for close in reversed(closes):
                price = self._number(close)
                if price is not None:
                    break
        if previous is None and len(closes) >= 2:
            for close in reversed(closes[:-1]):
                previous = self._number(close)
                if previous is not None:
                    break
        if price is None:
            raise RuntimeError("Yahoo Finance returned no current price.")
        return self._build_quote(normalized, price, previous, self._timestamp(meta.get("regularMarketTime") or (timestamps[-1] if timestamps else None)))

    def _quote_from_quote_endpoint(self, normalized: str, yahoo_symbol: str) -> MarketQuote:
        row = self._request_quote(yahoo_symbol)
        price = self._number(row.get("regularMarketPrice") or row.get("postMarketPrice") or row.get("preMarketPrice"))
        previous = self._number(row.get("regularMarketPreviousClose") or row.get("previousClose"))
        if price is None:
            raise RuntimeError("Yahoo quote endpoint returned no current price.")
        return self._build_quote(normalized, price, previous, self._timestamp(row.get("regularMarketTime")))

    def _quote_from_page(self, normalized: str, yahoo_symbol: str) -> MarketQuote:
        row = self._request_quote_page(yahoo_symbol)
        return self._build_quote(normalized, row["regularMarketPrice"], row.get("regularMarketPreviousClose"), row.get("regularMarketTime"))

    def _build_quote(self, normalized: str, price: float, previous: float | None, market_time: str | None, source: str | None = None) -> MarketQuote:
        change = price - previous if previous is not None else None
        change_percent = (change / previous) * 100 if change is not None and previous not in (None, 0) else None
        unit = "yield_percent" if normalized in {"US10Y", "10Y", "TNX"} else "price"
        return MarketQuote(symbol=normalized, price=price, previous_price=previous, change=change, change_percent=change_percent, timestamp=market_time, source=source or self.SOURCE, status=self._status(market_time), unit=unit)

    def get_quote(self, symbol: str) -> MarketQuote:
        normalized = symbol.upper()
        yahoo_symbol = self.yahoo_symbol(normalized)
        try:
            if yahoo_symbol:
                try:
                    return self._quote_from_chart(normalized, yahoo_symbol)
                except Exception as exc:
                    logger.warning("Yahoo chart failed for %s: %s", normalized, exc)
                try:
                    return self._quote_from_quote_endpoint(normalized, yahoo_symbol)
                except Exception as exc:
                    logger.warning("Yahoo quote failed for %s: %s", normalized, exc)
                try:
                    return self._quote_from_page(normalized, yahoo_symbol)
                except Exception as exc:
                    logger.warning("Yahoo page fallback failed for %s: %s", normalized, exc)
            if normalized in self.CBOE_SYMBOLS:
                try:
                    return self._quote_from_cboe(normalized)
                except Exception as exc:
                    logger.warning("CBOE fallback failed for %s: %s", normalized, exc)
            return MarketQuote(symbol=normalized, source=self.SOURCE, status="UNAVAILABLE", reason="Online market data is temporarily unavailable.")
        except Exception:
            return MarketQuote(symbol=normalized, source=self.SOURCE, status="UNAVAILABLE", reason="Online market data is temporarily unavailable.")
