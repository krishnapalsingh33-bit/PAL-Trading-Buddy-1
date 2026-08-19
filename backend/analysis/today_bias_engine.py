from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo


class TodayBiasEngine:
    """Build a GBP/USD directional view for TODAY and the currently active session.

    This is a decision-support layer, not an execution signal. TODAY bias is
    anchored to evidence relevant to the current calendar day. Session bias
    changes when London, New York or Tokyo becomes active and emphasizes the
    evidence most relevant to that session.
    """

    SESSION_ZONES = {
        "Asia": "Asia/Tokyo",
        "London": "Europe/London",
        "New York": "America/New_York",
    }

    BULLISH_TERMS = {
        "GBP": (
            "hawkish boe", "hawkish bank of england", "boe rate hike", "boe hikes",
            "uk inflation rises", "uk inflation remains elevated", "hot uk inflation",
            "strong uk growth", "uk growth accelerates", "uk wages accelerate",
            "wage growth accelerates", "uk employment strengthens", "unemployment falls",
        ),
        "USD": (
            "dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts",
            "rate cut bets rise", "rate cut expectations rise", "weak us inflation",
            "soft us inflation", "cooling us inflation", "us inflation falls",
            "weak us jobs", "weak us payrolls", "weak employment", "weak retail sales",
            "us growth slows", "slowing us growth", "economic slowdown",
        ),
    }

    BEARISH_TERMS = {
        "GBP": (
            "dovish boe", "dovish bank of england", "boe rate cut", "boe cuts",
            "uk inflation falls", "cooling uk inflation", "soft uk inflation",
            "weak uk growth", "uk growth slows", "uk employment weakens",
            "uk wages slow", "wage growth slows", "unemployment rises",
        ),
        "USD": (
            "hawkish fed", "hawkish federal reserve", "fed rate hike", "fed hikes",
            "higher for longer", "strong us inflation", "hot us inflation",
            "strong us jobs", "strong us payrolls", "strong employment",
            "strong retail sales", "strong us growth", "us growth accelerates",
        ),
    }

    def build(self, macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> dict[str, Any]:
        now_utc = now.astimezone(timezone.utc)
        today_score, today_reasons, today_evidence = self._score_today(macro_bias, news, now_utc)
        today = self._resolve(today_score)

        sessions: dict[str, Any] = {}
        for session in ("Asia", "London", "New York"):
            active = self._is_open(session, now_utc)
            score, reasons = self._session_score(session, today_score, macro_bias, news, now_utc)
            sessions[session] = {
                "active": active,
                "bias": self._resolve(score),
                "score": round(score, 2),
                "confidence": self._confidence(score, today_evidence),
                "reasons": reasons[:4],
                "updated_at": now_utc.isoformat(),
            }

        active_sessions = [name for name, item in sessions.items() if item["active"]]
        active_session = active_sessions[-1] if active_sessions else None

        return {
            "today": {
                "bias": today,
                "score": round(today_score, 2),
                "confidence": self._confidence(today_score, today_evidence),
                "reasons": today_reasons[:6],
                "evidence_count": today_evidence,
                "scope": "TODAY_ONLY",
                "updated_at": now_utc.isoformat(),
            },
            "sessions": sessions,
            "active_session": active_session,
        }

    def _score_today(self, macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> tuple[float, list[str], int]:
        gbp = macro_bias.get("gbp") or {}
        usd = macro_bias.get("dxy") or {}
        cross = macro_bias.get("gbpusd") or {}

        score = float(gbp.get("score") or 0) - float(usd.get("score") or 0)
        reasons: list[str] = []
        evidence = 0

        for side, bucket in (("GBP", news.get("gbp", [])), ("USD", news.get("usd", [])), ("CROSS", news.get("cross", []))):
            if not isinstance(bucket, list):
                continue
            for item in bucket:
                if not isinstance(item, dict):
                    continue
                if not self._is_today_relevant(item, now):
                    continue
                title = str(item.get("title", "")).lower()
                if not title:
                    continue
                evidence += 1
                for term in self.BULLISH_TERMS.get(side, ()):
                    if term in title:
                        score += 1.0 if side == "GBP" else (-1.0 if side == "USD" else 0.0)
                        reasons.append(f"{side}: {item.get('title', '')}")
                        break
                for term in self.BEARISH_TERMS.get(side, ()):
                    if term in title:
                        score += -1.0 if side == "GBP" else (1.0 if side == "USD" else 0.0)
                        reasons.append(f"{side}: {item.get('title', '')}")
                        break

        for event in news.get("recent_events", []) if isinstance(news.get("recent_events", []), list) else []:
            if not isinstance(event, dict) or not self._is_today_relevant(event, now):
                continue
            currency = str(event.get("currency", event.get("ccy", ""))).upper()
            surprise = self._surprise(event)
            if surprise is None:
                continue
            evidence += 1
            # Positive surprise is supportive for the currency; negative is adverse.
            if currency == "GBP":
                score += max(-2.0, min(2.0, surprise))
                reasons.append(f"GBP data surprise: {event.get('title', event.get('event', 'economic release'))}")
            elif currency == "USD":
                score -= max(-2.0, min(2.0, surprise))
                reasons.append(f"USD data surprise: {event.get('title', event.get('event', 'economic release'))}")

        # Preserve a genuinely strong existing macro signal, but keep TODAY as
        # the primary scope rather than carrying a weekly regime indefinitely.
        cross_score = float(cross.get("score") or 0)
        score += max(-1.5, min(1.5, cross_score * 0.25))
        return max(-10.0, min(10.0, score)), reasons, evidence

    def _session_score(self, session: str, today_score: float, macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> tuple[float, list[str]]:
        score = today_score
        reasons: list[str] = []
        focus = "GBP" if session == "London" else "USD" if session == "New York" else "GBP/USD"
        weights = {"GBP": 1.0, "USD": 1.0}
        if session == "London":
            weights = {"GBP": 1.35, "USD": 0.85}
        elif session == "New York":
            weights = {"GBP": 0.85, "USD": 1.35}
        else:
            weights = {"GBP": 0.95, "USD": 0.95}

        gbp_score = float((macro_bias.get("gbp") or {}).get("score") or 0)
        usd_score = float((macro_bias.get("dxy") or {}).get("score") or 0)
        weighted = gbp_score * weights["GBP"] - usd_score * weights["USD"]
        score = (score * 0.55) + (weighted * 0.45)

        upcoming = news.get("upcoming_events", [])
        if isinstance(upcoming, list):
            for event in upcoming:
                if not isinstance(event, dict):
                    continue
                currency = str(event.get("currency", event.get("ccy", ""))).upper()
                minutes = event.get("minutes")
                if currency not in {"GBP", "USD"}:
                    continue
                if isinstance(minutes, (int, float)) and 0 <= minutes <= 180:
                    if currency == focus or (session == "Asia" and currency in {"GBP", "USD"}):
                        reasons.append(f"{currency} catalyst within {int(minutes)} minutes: {event.get('title', event.get('event', 'macro event'))}")

        for side in ("GBP", "USD"):
            bucket = news.get(side.lower(), [])
            if not isinstance(bucket, list):
                continue
            for item in bucket:
                if not isinstance(item, dict) or not self._is_today_relevant(item, now):
                    continue
                title = str(item.get("title", ""))
                if title:
                    if side == "GBP" and session == "London":
                        reasons.append(f"London focus: {title}")
                    elif side == "USD" and session == "New York":
                        reasons.append(f"New York focus: {title}")
                    if len(reasons) >= 4:
                        break

        if not reasons:
            reasons.append(f"{session} inherits today's GBP/USD macro balance with no new session-specific catalyst detected.")
        return max(-10.0, min(10.0, score)), reasons

    @staticmethod
    def _is_open(session: str, now_utc: datetime) -> bool:
        zone = ZoneInfo(TodayBiasEngine.SESSION_ZONES[session])
        local = now_utc.astimezone(zone)
        if local.weekday() >= 5:
            return False
        return 8 <= local.hour < 17

    @staticmethod
    def _is_today_relevant(item: dict[str, Any], now: datetime) -> bool:
        for key in ("published_at", "published", "time", "scheduled_time", "timestamp"):
            value = item.get(key)
            if not value:
                continue
            try:
                parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc).date() == now.date()
            except Exception:
                continue
        # Providers without timestamps are still current feed evidence.
        return True

    @staticmethod
    def _surprise(event: dict[str, Any]) -> float | None:
        try:
            actual = float(event.get("actual"))
            forecast = float(event.get("forecast"))
        except (TypeError, ValueError):
            return None
        if forecast == 0:
            return None
        return max(-2.0, min(2.0, (actual - forecast) / max(abs(forecast), 1.0)))

    @staticmethod
    def _resolve(score: float) -> str:
        if score >= 1.5:
            return "BULLISH"
        if score <= -1.5:
            return "BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _confidence(score: float, evidence: int) -> int:
        base = min(90, int(abs(score) * 10 + evidence * 4))
        return max(20, base) if evidence or abs(score) > 0.5 else 15
