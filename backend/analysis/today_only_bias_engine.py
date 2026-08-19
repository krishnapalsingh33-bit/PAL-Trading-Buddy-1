from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo


class TodayOnlyBiasEngine:
    """Independent TODAY-only GBP/USD bias engine.

    No MacroBiasEngine score, weekly regime, or broader macro bias is used.
    Direction comes only from dated current-day news, released actual-vs-
    forecast data, and light current-day price context. Upcoming events are
    context/risk only and cannot create direction.
    """

    ZONES = {"Asia": "Asia/Tokyo", "London": "Europe/London", "New York": "America/New_York"}
    GBP_POS = ("hawkish boe", "boe rate hike", "boe hikes", "boe tightening", "uk inflation rises", "uk inflation rose", "uk inflation jumps", "uk inflation jumped", "uk inflation remains elevated", "hot uk inflation", "strong uk growth", "uk growth accelerates", "strong uk economy", "uk employment strengthens", "unemployment falls", "uk wages accelerate", "wage growth accelerates", "strong retail sales", "sterling gains", "pound gains")
    GBP_NEG = ("dovish boe", "boe rate cut", "boe cuts", "boe easing", "uk inflation falls", "uk inflation fell", "uk inflation drops", "uk inflation dropped", "cooling uk inflation", "soft uk inflation", "weak uk growth", "uk growth slows", "uk recession", "uk employment weakens", "uk wages slow", "wage growth slows", "unemployment rises", "weak retail sales", "sterling falls", "pound falls")
    USD_POS = ("hawkish fed", "hawkish federal reserve", "fed rate hike", "fed hikes", "higher for longer", "fed tightening", "rate hike bets rise", "strong us inflation", "hot us inflation", "us inflation rises", "us inflation rose", "sticky us inflation", "strong us jobs", "strong us payrolls", "strong employment", "falling unemployment", "strong retail sales", "strong us growth", "us growth accelerates", "dollar gains", "dollar rises")
    USD_NEG = ("dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts", "fed easing", "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade", "weak us inflation", "soft us inflation", "cooling us inflation", "us inflation falls", "us inflation fell", "weak us jobs", "weak us payrolls", "weak employment", "rising unemployment", "weak retail sales", "weak us growth", "us growth slows", "economic slowdown", "dollar falls", "dollar drops")
    LOWER_IS_BETTER = ("unemployment", "jobless claims", "initial jobless claims", "continuing claims")

    def build(self, _macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> dict[str, Any]:
        now = now.astimezone(timezone.utc)
        gbp = usd = 0.0
        reasons: list[str] = []
        evidence = 0

        for item in self._today_news(news, now):
            c = self._currency(item); title = self._text(item)
            if c not in {"GBP", "USD"} or not title: continue
            direction = self._headline_direction(c, title)
            if direction == 0: continue
            weight = self._source_weight(item)
            if c == "GBP": gbp += direction * weight
            else: usd += direction * weight
            evidence += 1; reasons.append(f"{c}: {title}")

        for event in self._today_releases(news, now):
            c = self._currency(event); surprise = self._surprise(event)
            if c not in {"GBP", "USD"} or surprise is None: continue
            title = self._text(event).lower()
            if any(x in title for x in self.LOWER_IS_BETTER): surprise = -surprise
            score = max(-2.0, min(2.0, surprise * 1.5 * self._impact(event)))
            if c == "GBP": gbp += score
            else: usd += score
            evidence += 1
            reasons.append(f"{c} data: {self._text(event) or 'economic release'} (actual {event.get('actual')} vs forecast {event.get('forecast')})")

        markets = news.get("markets") or {}
        pair_change = self._change(self._quote(markets, ("GBPUSD", "GBP/USD")))
        dxy_change = self._change(self._quote(markets, ("DXY",)))
        if pair_change is not None: gbp += max(-1, min(1, pair_change / .50)) * .35; evidence += 1; reasons.append(f"GBP/USD today: {pair_change:+.2f}%")
        if dxy_change is not None: usd += max(-1, min(1, dxy_change / .50)) * .35; evidence += 1; reasons.append(f"DXY today: {dxy_change:+.2f}%")

        gbp, usd = max(-5, min(5, gbp)), max(-5, min(5, usd))
        pair = max(-10, min(10, gbp - usd))
        sessions = {}
        for name in ("Asia", "London", "New York"):
            s = pair
            if name == "London": s = pair * .75 + gbp * .25
            if name == "New York": s = pair * .75 - usd * .25
            sessions[name] = {"active": self._open(name, now), "bias": self._resolve(s), "score": round(s, 2), "confidence": self._confidence(s, evidence), "reasons": reasons[:4], "updated_at": now.isoformat()}

        return {"today": {"bias": self._resolve(pair), "dxy": {"bias": self._resolve(usd), "score": round(usd, 2)}, "gbp": {"bias": self._resolve(gbp), "score": round(gbp, 2)}, "gbpusd": {"bias": self._resolve(pair), "score": round(pair, 2)}, "score": round(pair, 2), "confidence": self._confidence(pair, evidence), "reasons": reasons[:8], "evidence_count": evidence, "scope": "TODAY_ONLY", "source": "today_news_calendar_market_data", "updated_at": now.isoformat()}, "sessions": sessions, "active_session": next((n for n, x in sessions.items() if x["active"]), None)}

    @staticmethod
    def _today_news(news, now):
        out=[]; seen=set()
        for key in ("headlines", "gbp", "usd"):
            for item in news.get(key, []) if isinstance(news.get(key, []), list) else []:
                if not isinstance(item, dict) or not TodayOnlyBiasEngine._today(item, now): continue
                k=TodayOnlyBiasEngine._text(item).lower()
                if k and k not in seen: seen.add(k); out.append(item)
        return out

    @staticmethod
    def _today_releases(news, now):
        out=[]; seen=set()
        for key in ("recent_events", "events"):
            for item in news.get(key, []) if isinstance(news.get(key, []), list) else []:
                if not isinstance(item, dict) or not TodayOnlyBiasEngine._today(item, now) or TodayOnlyBiasEngine._surprise(item) is None: continue
                k=str(item.get("id") or item.get("title") or "").lower()
                if k not in seen: seen.add(k); out.append(item)
        return out

    @staticmethod
    def _today(item, now):
        for key in ("published_at", "published", "time", "scheduled_time", "timestamp", "date"):
            value=item.get(key)
            if not value: continue
            try:
                d=datetime.fromisoformat(str(value).replace("Z", "+00:00")); d=d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
                return d.astimezone(timezone.utc).date() == now.date()
            except (TypeError, ValueError): pass
        return False

    @staticmethod
    def _currency(item):
        c=str(item.get("currency", item.get("ccy", "")) or "").upper()
        if c in {"GBP", "USD"}: return c
        t=TodayOnlyBiasEngine._text(item).lower()
        if any(x in t for x in ("boe", "bank of england", "sterling", "pound", "uk ", "britain")): return "GBP"
        if any(x in t for x in ("fed", "federal reserve", "dollar", "us ", "u.s.")): return "USD"
        return ""

    @staticmethod
    def _text(item): return str(item.get("title", item.get("event", "")) or "").strip()

    @staticmethod
    def _headline_direction(c, title):
        t=title.lower(); pos=TodayOnlyBiasEngine.GBP_POS if c=="GBP" else TodayOnlyBiasEngine.USD_POS; neg=TodayOnlyBiasEngine.GBP_NEG if c=="GBP" else TodayOnlyBiasEngine.USD_NEG
        p=sum(x in t for x in pos); n=sum(x in t for x in neg)
        return 0 if p==n else (1 if p>n else -1)

    @staticmethod
    def _source_weight(item):
        s=str(item.get("source", item.get("provider", ""))).lower()
        return 1.25 if any(x in s for x in ("reuters", "bloomberg", "financial times", "wsj")) else (1.1 if any(x in s for x in ("cnbc", "ft", "ing")) else 1.0)

    @staticmethod
    def _impact(event): return {"high":1.0,"medium":.85,"low":.6}.get(str(event.get("impact", "")).lower(), .8)

    @staticmethod
    def _surprise(event):
        try: a,f=float(event.get("actual")),float(event.get("forecast"))
        except (TypeError,ValueError): return None
        return None if f==0 else max(-2,min(2,(a-f)/max(abs(f),1)))

    @staticmethod
    def _quote(markets, keys):
        if not isinstance(markets, dict): return {}
        for k in keys:
            if isinstance(markets.get(k), dict): return markets[k]
        return {}

    @staticmethod
    def _change(q):
        try: return float(q.get("change_percent")) if q.get("change_percent") is not None else None
        except (TypeError,ValueError): return None

    @staticmethod
    def _open(name, now):
        local=now.astimezone(ZoneInfo(TodayOnlyBiasEngine.ZONES[name])); return local.weekday()<5 and 8<=local.hour<17

    @staticmethod
    def _resolve(s): return "BULLISH" if s>=1.25 else ("BEARISH" if s<=-1.25 else "NEUTRAL")

    @staticmethod
    def _confidence(s,e): return 10 if e==0 else max(20,min(90,int(abs(s)*10+e*6)))
