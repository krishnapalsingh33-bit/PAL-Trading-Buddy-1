from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import requests


class ForexIntelligenceService:
    """Real-data multi-timeframe Forex analysis using Yahoo Finance chart data."""

    BASE_URLS = (
        "https://query1.finance.yahoo.com/v8/finance/chart",
        "https://query2.finance.yahoo.com/v8/finance/chart",
    )

    SYMBOL_MAP = {
        "EURUSD": "EURUSD=X", "EUR/USD": "EURUSD=X",
        "GBPUSD": "GBPUSD=X", "GBP/USD": "GBPUSD=X",
        "USDJPY": "JPY=X", "USD/JPY": "JPY=X",
        "USDCHF": "CHF=X", "USD/CHF": "CHF=X",
        "USDCAD": "CAD=X", "USD/CAD": "CAD=X",
        "AUDUSD": "AUDUSD=X", "AUD/USD": "AUDUSD=X",
        "NZDUSD": "NZDUSD=X", "NZD/USD": "NZDUSD=X",
        "EURGBP": "EURGBP=X", "EUR/GBP": "EURGBP=X",
        "EURJPY": "EURJPY=X", "EUR/JPY": "EURJPY=X",
        "GBPJPY": "GBPJPY=X", "GBP/JPY": "GBPJPY=X",
        "AUDJPY": "AUDJPY=X", "AUD/JPY": "AUDJPY=X",
        "CADJPY": "CADJPY=X", "CAD/JPY": "CADJPY=X",
        "CHFJPY": "CHFJPY=X", "CHF/JPY": "CHFJPY=X",
        "EURAUD": "EURAUD=X", "EUR/AUD": "EURAUD=X",
        "EURCAD": "EURCAD=X", "EUR/CAD": "EURCAD=X",
        "EURNZD": "EURNZD=X", "EUR/NZD": "EURNZD=X",
        "GBPAUD": "GBPAUD=X", "GBP/AUD": "GBPAUD=X",
        "GBPCAD": "GBPCAD=X", "GBP/CAD": "GBPCAD=X",
        "GBPNZD": "GBPNZD=X", "GBP/NZD": "GBPNZD=X",
        "AUDCAD": "AUDCAD=X", "AUD/CAD": "AUDCAD=X",
        "AUDNZD": "AUDNZD=X", "AUD/NZD": "AUDNZD=X",
        "CADCHF": "CADCHF=X", "CAD/CHF": "CADCHF=X",
        "NZDCAD": "NZDCAD=X", "NZD/CAD": "NZDCAD=X",
        "NZDJPY": "NZDJPY=X", "NZD/JPY": "NZDJPY=X",
    }

    TIMEFRAMES = {
        "15M": {"interval": "15m", "range": "5d", "periods": 96},
        "30M": {"interval": "30m", "range": "10d", "periods": 96},
        "1H": {"interval": "1h", "range": "1mo", "periods": 96},
        "4H": {"interval": "1h", "range": "3mo", "periods": 96},
    }

    SUPPORTED = tuple(sorted({key for key in SYMBOL_MAP if "/" not in key}))

    def __init__(self, timeout_seconds: float = 10.0, session: requests.Session | None = None) -> None:
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "PAL-Trading-Buddy/1.0",
            "Accept": "application/json,text/plain,*/*",
        })

    @classmethod
    def normalize(cls, symbol: str) -> str:
        normalized = symbol.upper().replace(" ", "")
        if normalized not in cls.SYMBOL_MAP:
            raise ValueError(f"Unsupported forex pair: {symbol}")
        return normalized.replace("/", "")

    @classmethod
    def display_label(cls, symbol: str) -> str:
        normalized = cls.normalize(symbol)
        return f"{normalized[:3]}/{normalized[3:]}"

    @classmethod
    def currencies(cls, symbol: str) -> tuple[str, str]:
        normalized = cls.normalize(symbol)
        return normalized[:3], normalized[3:]

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
                payload = response.json()
                chart = payload.get("chart") or {}
                if chart.get("error"):
                    raise RuntimeError((chart.get("error") or {}).get("description") or "Yahoo Finance returned an error.")
                result = (chart.get("result") or [None])[0]
                if not result:
                    raise RuntimeError("Yahoo Finance returned no chart data.")
                timestamps = result.get("timestamp") or []
                quote = (((result.get("indicators") or {}).get("quote") or [{}])[0])
                opens = quote.get("open") or []
                highs = quote.get("high") or []
                lows = quote.get("low") or []
                closes = quote.get("close") or []
                volumes = quote.get("volume") or []
                rows = []
                for index, timestamp in enumerate(timestamps):
                    close = self._number(closes[index] if index < len(closes) else None)
                    if close is None:
                        continue
                    rows.append({
                        "time": datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat(),
                        "open": self._number(opens[index] if index < len(opens) else None),
                        "high": self._number(highs[index] if index < len(highs) else None),
                        "low": self._number(lows[index] if index < len(lows) else None),
                        "close": close,
                        "volume": self._number(volumes[index] if index < len(volumes) else None),
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
            ema = (value - ema) * multiplier + ema
        return ema

    @staticmethod
    def _rsi(values: list[float], period: int = 14) -> float | None:
        if len(values) <= period:
            return None
        gains: list[float] = []
        losses: list[float] = []
        for index in range(1, len(values)):
            delta = values[index] - values[index - 1]
            gains.append(max(delta, 0.0))
            losses.append(max(-delta, 0.0))
        if len(gains) < period:
            return None
        average_gain = sum(gains[:period]) / period
        average_loss = sum(losses[:period]) / period
        for index in range(period, len(gains)):
            average_gain = ((average_gain * (period - 1)) + gains[index]) / period
            average_loss = ((average_loss * (period - 1)) + losses[index]) / period
        if average_loss == 0:
            return 100.0
        relative_strength = average_gain / average_loss
        return 100 - (100 / (1 + relative_strength))

    @staticmethod
    def _bias(close: float, ema20: float | None, ema50: float | None, rsi: float | None) -> tuple[str, int, str]:
        if ema20 is None or ema50 is None or rsi is None:
            return "UNKNOWN", 0, "Insufficient data for a reliable timeframe assessment."
        score = 0
        score += 1 if close > ema20 else -1
        score += 1 if ema20 > ema50 else -1
        score += 1 if rsi >= 55 else -1 if rsi <= 45 else 0
        if score >= 2:
            bias = "BULLISH"
        elif score <= -2:
            bias = "BEARISH"
        else:
            bias = "NEUTRAL"
        confidence = min(95, max(50, 50 + abs(score) * 15))
        if bias == "BULLISH":
            reason = "Price is above EMA20 with medium-term alignment and positive momentum."
        elif bias == "BEARISH":
            reason = "Price is below EMA20 with medium-term alignment and negative momentum."
        else:
            reason = "Trend and momentum are mixed; PAL is keeping the timeframe neutral."
        return bias, confidence, reason

    def _timeframe(self, yahoo_symbol: str, timeframe: str) -> dict[str, Any]:
        config = self.TIMEFRAMES[timeframe]
        rows = self._fetch(yahoo_symbol, config["interval"], config["range"])
        if timeframe == "4H":
            rows = self._aggregate_four_hour(rows)
        closes = [float(row["close"]) for row in rows if row.get("close") is not None]
        latest = rows[-1]
        ema20 = self._ema(closes, 20)
        ema50 = self._ema(closes, 50)
        rsi = self._rsi(closes, 14)
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
            "observations": len(rows),
            "timestamp": latest["time"],
        }

    @staticmethod
    def _aggregate_four_hour(rows: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
        grouped: dict[str, dict[str, Any]] = {}
        for row in rows:
            timestamp = datetime.fromisoformat(str(row["time"]).replace("Z", "+00:00"))
            bucket = timestamp.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0, hour=(timestamp.hour // 4) * 4)
            key = bucket.isoformat()
            current = grouped.get(key)
            if current is None:
                grouped[key] = {"time": key, "open": row.get("open"), "high": row.get("high"), "low": row.get("low"), "close": row.get("close"), "volume": row.get("volume")}
                continue
            current["high"] = max(float(current["high"] or row["high"]), float(row["high"] or current["high"])) if row.get("high") is not None else current["high"]
            current["low"] = min(float(current["low"] or row["low"]), float(row["low"] or current["low"])) if row.get("low") is not None else current["low"]
            current["close"] = row.get("close")
            if row.get("volume") is not None:
                current["volume"] = float(current.get("volume") or 0) + float(row["volume"])
        return list(grouped.values())

    def analyze(self, symbol: str) -> dict[str, Any]:
        normalized = self.normalize(symbol)
        yahoo_symbol = self.SYMBOL_MAP[normalized]
        timeframe_data = {timeframe: self._timeframe(yahoo_symbol, timeframe) for timeframe in self.TIMEFRAMES}
        usable = [value for value in timeframe_data.values() if value["bias"] != "UNKNOWN"]
        bull = sum(1 for value in usable if value["bias"] == "BULLISH")
        bear = sum(1 for value in usable if value["bias"] == "BEARISH")
        if bull >= 3:
            overall = "BULLISH"
        elif bear >= 3:
            overall = "BEARISH"
        elif bull > bear:
            overall = "LEAN BULLISH"
        elif bear > bull:
            overall = "LEAN BEARISH"
        else:
            overall = "NEUTRAL"
        avg_confidence = round(sum(value["confidence"] for value in usable) / len(usable)) if usable else 0
        return {
            "symbol": normalized,
            "label": self.display_label(normalized),
            "base_currency": normalized[:3],
            "quote_currency": normalized[3:],
            "overall_bias": overall,
            "confidence": avg_confidence,
            "timeframes": timeframe_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Yahoo Finance",
        }
