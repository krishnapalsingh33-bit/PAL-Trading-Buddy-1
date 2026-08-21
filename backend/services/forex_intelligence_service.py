from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import requests


CURRENCIES = ("AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD")


class ForexIntelligenceService:
    """Real-data Forex intelligence for every directed pair across 8 G10 currencies."""

    BASE_URLS = (
        "https://query1.finance.yahoo.com/v8/finance/chart",
        "https://query2.finance.yahoo.com/v8/finance/chart",
    )
    TIMEFRAMES = {
        "15M": {"interval": "15m", "range": "5d"},
        "30M": {"interval": "30m", "range": "10d"},
        "1H": {"interval": "1h", "range": "1mo"},
        "4H": {"interval": "1h", "range": "3mo"},
    }
    SUPPORTED = tuple(sorted(f"{base}{quote}" for base in CURRENCIES for quote in CURRENCIES if base != quote))

    def __init__(self, timeout_seconds: float = 10.0, session: requests.Session | None = None) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "PAL-Trading-Buddy/1.0", "Accept": "application/json,text/plain,*/*"})

    @classmethod
    def normalize(cls, symbol: str) -> str:
        normalized = symbol.upper().replace(" ", "").replace("/", "")
        if normalized not in cls.SUPPORTED:
            raise ValueError(f"Unsupported forex pair: {symbol}. Supported universe contains {len(cls.SUPPORTED)} pairs.")
        return normalized

    @classmethod
    def display_label(cls, symbol: str) -> str:
        normalized = cls.normalize(symbol)
        return f"{normalized[:3]}/{normalized[3:]}"

    @classmethod
    def currencies(cls, symbol: str) -> tuple[str, str]:
        normalized = cls.normalize(symbol)
        return normalized[:3], normalized[3:]

    @classmethod
    def yahoo_symbol(cls, symbol: str) -> str:
        normalized = cls.normalize(symbol)
        base, quote = normalized[:3], normalized[3:]
        if base == "USD":
            return f"{quote}=X"
        if quote == "USD":
            return f"{base}USD=X"
        return f"{base}{quote}=X"

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            number = float(value)
            return number if math.isfinite(number) else None
        except (TypeError, ValueError):
            return None

    def _fetch(self, yahoo_symbol: str, interval: str, range_value: str) -> list[dict[str, float | str]]:
        last_error: Exception | None = None
        for base_url in self.BASE_URLS:
            try:
                response = self.session.get(
                    f"{base_url}/{yahoo_symbol}",
                    params={"range": range_value, "interval": interval, "events": "history", "includePrePost": "false"},
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                chart = response.json().get("chart") or {}
                if chart.get("error"):
                    raise RuntimeError((chart["error"] or {}).get("description") or "Yahoo Finance returned an error.")
                result = (chart.get("result") or [None])[0]
                if not result:
                    raise RuntimeError("Yahoo Finance returned no chart data.")
                timestamps = result.get("timestamp") or []
                quote = (((result.get("indicators") or {}).get("quote") or [{}])[0])
                rows = []
                for index, timestamp in enumerate(timestamps):
                    close = self._number((quote.get("close") or [])[index] if index < len(quote.get("close") or []) else None)
                    if close is None:
                        continue
                    rows.append({
                        "time": datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat(),
                        "open": self._number((quote.get("open") or [])[index] if index < len(quote.get("open") or []) else None),
                        "high": self._number((quote.get("high") or [])[index] if index < len(quote.get("high") or []) else None),
                        "low": self._number((quote.get("low") or [])[index] if index < len(quote.get("low") or []) else None),
                        "close": close,
                    })
                if len(rows) < 30:
                    raise RuntimeError("Not enough chart observations returned.")
                return rows
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"Market chart unavailable: {last_error}")

    @staticmethod
    def _ema(values: list[float], period: int) -> float | None:
        if len(values) < period:
            return None
        multiplier = 2 / (period + 1)
        ema = sum(values[:period]) / period
        for value in values[period:]:
            ema += (value - ema) * multiplier
        return ema

    @staticmethod
    def _rsi(values: list[float], period: int = 14) -> float | None:
        if len(values) <= period:
            return None
        gains, losses = [], []
        for index in range(1, len(values)):
            delta = values[index] - values[index - 1]
            gains.append(max(delta, 0.0))
            losses.append(max(-delta, 0.0))
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period
        for index in range(period, len(gains)):
            avg_gain = ((avg_gain * (period - 1)) + gains[index]) / period
            avg_loss = ((avg_loss * (period - 1)) + losses[index]) / period
        if avg_loss == 0:
            return 100.0
        return 100 - (100 / (1 + (avg_gain / avg_loss)))

    @staticmethod
    def _aggregate_four_hour(rows: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
        grouped: dict[str, dict[str, float | str]] = {}
        for row in rows:
            timestamp = datetime.fromisoformat(str(row["time"]).replace("Z", "+00:00")).astimezone(timezone.utc)
            bucket = timestamp.replace(hour=(timestamp.hour // 4) * 4, minute=0, second=0, microsecond=0)
            key = bucket.isoformat()
            current = grouped.get(key)
            if current is None:
                grouped[key] = {"time": key, "open": row.get("open"), "high": row.get("high"), "low": row.get("low"), "close": row.get("close")}
            else:
                if row.get("high") is not None:
                    current["high"] = max(float(current["high"] or row["high"]), float(row["high"]))
                if row.get("low") is not None:
                    current["low"] = min(float(current["low"] or row["low"]), float(row["low"]))
                current["close"] = row.get("close")
        return list(grouped.values())

    @staticmethod
    def _bias(close: float, ema20: float | None, ema50: float | None, rsi: float | None) -> tuple[str, int, str]:
        if ema20 is None or ema50 is None or rsi is None:
            return "UNKNOWN", 0, "Insufficient data."
        score = (1 if close > ema20 else -1) + (1 if ema20 > ema50 else -1) + (1 if rsi >= 55 else -1 if rsi <= 45 else 0)
        bias = "BULLISH" if score >= 2 else "BEARISH" if score <= -2 else "NEUTRAL"
        confidence = min(95, 50 + abs(score) * 15)
        reason = "Price, EMA alignment and momentum are supportive." if bias == "BULLISH" else "Price, EMA alignment and momentum are negative." if bias == "BEARISH" else "Trend and momentum are mixed."
        return bias, confidence, reason

    def _timeframe(self, yahoo_symbol: str, timeframe: str) -> dict[str, Any]:
        cfg = self.TIMEFRAMES[timeframe]
        rows = self._fetch(yahoo_symbol, cfg["interval"], cfg["range"])
        if timeframe == "4H":
            rows = self._aggregate_four_hour(rows)
        closes = [float(row["close"]) for row in rows]
        latest = rows[-1]
        ema20, ema50, rsi = self._ema(closes, 20), self._ema(closes, 50), self._rsi(closes)
        bias, confidence, reason = self._bias(float(latest["close"]), ema20, ema50, rsi)
        return {
            "timeframe": timeframe,
            "bias": bias,
            "confidence": confidence,
            "price": latest["close"],
            "ema20": round(ema20, 6) if ema20 is not None else None,
            "ema50": round(ema50, 6) if ema50 is not None else None,
            "rsi14": round(rsi, 2) if rsi is not None else None,
            "reason": reason,
            "timestamp": latest["time"],
            "candles": rows[-100:],
        }

    def analyze(self, symbol: str) -> dict[str, Any]:
        normalized = self.normalize(symbol)
        yahoo_symbol = self.yahoo_symbol(normalized)
        timeframes = {name: self._timeframe(yahoo_symbol, name) for name in self.TIMEFRAMES}
        usable = [item for item in timeframes.values() if item["bias"] != "UNKNOWN"]
        bull = sum(item["bias"] == "BULLISH" for item in usable)
        bear = sum(item["bias"] == "BEARISH" for item in usable)
        overall = "BULLISH" if bull >= 3 else "BEARISH" if bear >= 3 else "LEAN BULLISH" if bull > bear else "LEAN BEARISH" if bear > bull else "NEUTRAL"
        confidence = round(sum(item["confidence"] for item in usable) / len(usable)) if usable else 0
        return {
            "symbol": normalized,
            "label": self.display_label(normalized),
            "base_currency": normalized[:3],
            "quote_currency": normalized[3:],
            "overall_bias": overall,
            "confidence": confidence,
            "timeframes": timeframes,
            "supported_pairs": len(self.SUPPORTED),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Yahoo Finance",
        }
