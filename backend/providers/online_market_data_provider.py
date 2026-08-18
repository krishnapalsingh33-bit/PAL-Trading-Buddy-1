from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import requests

from models.market_quote import MarketQuote
from providers.market_data_provider import MarketDataProvider


logger = logging.getLogger(__name__)


class YahooMarketDataProvider(MarketDataProvider):
    """Online snapshot provider isolated behind MarketDataProvider."""

    BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
    SOURCE = "Yahoo Finance"

    SYMBOL_MAP = {
        "DXY": "DX-Y.NYB",
        "GBPUSD": "GBPUSD=X",
        "GBP/USD": "GBPUSD=X",
        "XAUUSD": "GC=F",
        "GOLD": "GC=F",
        "XAU/USD": "GC=F",
        "USOIL": "CL=F",
        "WTI": "CL=F",
        "OIL": "CL=F",
        "XTIUSD": "CL=F",
        "US10Y": "^TNX",
        "10Y": "^TNX",
        "TNX": "^TNX",
        "US500": "^GSPC",
        "SPX": "^GSPC",
        "SP500": "^GSPC",
    }

    def __init__(self, timeout_seconds: float = 8.0, session: requests.Session | None = None) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/2.1 (cloud market intelligence)",
            "Accept": "application/json",
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

    def get_quote(self, symbol: str) -> MarketQuote:
        normalized = symbol.upper()
        yahoo_symbol = self.yahoo_symbol(normalized)

        if yahoo_symbol is None:
            return MarketQuote(symbol=normalized, source=self.SOURCE, status="UNAVAILABLE", reason="No online symbol mapping is configured.")

        try:
            response = self.session.get(
                f"{self.BASE_URL}/{yahoo_symbol}",
                params={"range": "5d", "interval": "1d", "events": "history", "includePrePost": "true"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            chart = payload.get("chart", {})
            if chart.get("error"):
                raise RuntimeError(chart["error"].get("description", "Yahoo Finance returned an error."))

            results = chart.get("result") or []
            if not results:
                raise RuntimeError("Yahoo Finance returned no quote data.")

            result = results[0]
            meta = result.get("meta") or {}
            price = self._number(meta.get("regularMarketPrice") or meta.get("postMarketPrice") or meta.get("preMarketPrice"))
            previous = self._number(meta.get("previousClose") or meta.get("chartPreviousClose"))

            timestamps = result.get("timestamp") or []
            quote_rows = (result.get("indicators") or {}).get("quote") or []
            closes = quote_rows[0].get("close", []) if quote_rows else []

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

            change = price - previous if previous is not None else None
            change_percent = (change / previous) * 100 if change is not None and previous not in (None, 0) else None
            market_time = self._timestamp(meta.get("regularMarketTime") or (timestamps[-1] if timestamps else None))
            unit = "yield_percent" if normalized in {"US10Y", "10Y", "TNX"} else "price"

            return MarketQuote(
                symbol=normalized,
                price=price,
                previous_price=previous,
                change=change,
                change_percent=change_percent,
                timestamp=market_time,
                source=self.SOURCE,
                status="CURRENT",
                unit=unit,
            )
        except Exception as exc:
            logger.warning("Online market provider failed for %s (%s): %s", normalized, yahoo_symbol, exc)
            return MarketQuote(symbol=normalized, source=self.SOURCE, status="UNAVAILABLE", reason="Online market data is temporarily unavailable.")
