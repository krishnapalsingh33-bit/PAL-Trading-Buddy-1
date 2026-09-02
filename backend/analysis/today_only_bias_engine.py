from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo


class TodayOnlyBiasEngine:
    """Compact TODAY-only fundamental bias built from released data + fresh macro news."""

    ZONES = {"London": "Europe/London", "New York": "America/New_York"}
    GBP_POS = ("hawkish boe", "boe rate hike", "boe hikes", "boe tightening", "uk inflation rises", "uk inflation rose", "uk inflation accelerates", "uk inflation accelerated", "uk inflation remains elevated", "hot uk inflation", "strong uk growth", "uk growth accelerates", "strong uk economy", "uk employment strengthens", "uk wages accelerate", "wage growth accelerates", "strong retail sales")
    GBP_NEG = ("dovish boe", "boe rate cut", "boe cuts", "boe easing", "uk inflation falls", "uk inflation fell", "uk inflation drops", "uk inflation dropped", "cooling uk inflation", "soft uk inflation", "weak uk growth", "uk growth slows", "uk recession", "uk employment weakens", "uk wages slow", "wage growth slows", "unemployment rises", "weak retail sales")
    USD_POS = ("hawkish fed", "hawkish federal reserve", "fed rate hike", "fed hikes", "higher for longer", "fed tightening", "rate hike bets rise", "strong us inflation", "hot us inflation", "us inflation rises", "us inflation rose", "sticky us inflation", "strong us jobs", "strong us payrolls", "strong employment", "falling unemployment", "strong retail sales", "strong us growth", "us growth accelerates")
    USD_NEG = ("dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts", "fed easing", "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade", "weak us inflation", "soft us inflation", "cooling us inflation", "us inflation falls", "us inflation fell", "weak us jobs", "weak us payrolls", "weak employment", "rising unemployment", "weak retail sales", "weak us growth", "us growth slows", "economic slowdown")
    LOWER_IS_BETTER = ("unemployment", "jobless claims", "initial jobless claims", "continuing claims")

    def build(self, _macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> dict[str, Any]:
        now = now.astimezone(timezone.utc)
        gbp = usd = 0.0
        evidence = 0
        reasons: list[str] = []

        for item in self._today_news(news, now):
            currency = self._currency(item); title = self._text(item)
            if currency not in {"GBP", "USD"} or not title:
                continue
            direction = self._headline_direction(currency, title)
            if not direction:
                continue
            score = direction * self._source_weight(item)
            if currency == "GBP": gbp += score
            else: usd += score
            evidence += 1
            reasons.append(f"{currency}: {title}")

        for event in self._today_releases(news, now):
            currency = self._currency(event); surprise = self._surprise(event)
            if currency not in {"GBP", "USD"} or surprise is None:
                continue
            title = self._text(event).lower()
            if any(term in title for term in self.LOWER_IS_BETTER): surprise = -surprise
            if abs(surprise) < 0.0001:
                surprise = self._previous_surprise(event)
                if surprise is None: continue
            score = max(-2.0, min(2.0, surprise * 1.5 * self._impact(event)))
            if currency == "GBP": gbp += score
            else: usd += score
            evidence += 1
            reasons.append(f"{currency} data: {self._text(event)} — actual {event.get('actual')} vs forecast {event.get('forecast')}")

        pair_change = self._change(self._quote(news.get("markets") or {}, ("GBPUSD", "GBP/USD")))
        dxy_change = self._change(self._quote(news.get("markets") or {}, ("DXY",)))
        if pair_change is not None: gbp += max(-1, min(1, pair_change / .50)) * .35; evidence += 1
        if dxy_change is not None: usd += max(-1, min(1, dxy_change / .50)) * .35; evidence += 1

        gbp, usd = max(-5, min(5, gbp)), max(-5, min(5, usd))
        pair = max(-10, min(10, gbp - usd))
        sessions = {}
        for name in ("London", "New York"):
            score = pair * .75 + (gbp if name == "London" else -usd) * .25
            sessions[name] = {"active": self._open(name, now), "bias": self._resolve(score, evidence), "score": round(score, 2), "confidence": self._confidence(score, evidence), "reasons": reasons[:3], "updated_at": now.isoformat()}

        return {
            "today": {
                "bias": self._resolve(pair, evidence),
                "dxy": {"bias": self._resolve(usd, evidence), "score": round(usd, 2)},
                "gbp": {"bias": self._resolve(gbp, evidence), "score": round(gbp, 2)},
                "gbpusd": {"bias": self._resolve(pair, evidence), "score": round(pair, 2)},
                "score": round(pair, 2), "confidence": self._confidence(pair, evidence),
                "reasons": reasons[:6], "evidence_count": evidence, "scope": "TODAY_ONLY", "updated_at": now.isoformat()
            },
            "sessions": sessions,
            "active_session": next((n for n, x in sessions.items() if x["active"]), None),
        }

    @classmethod
    def _today_news(cls, news, now):
        out=[]; seen=set()
        for key in ("headlines", "gbp", "usd"):
            bucket = news.get(key, [])
            for item in bucket if isinstance(bucket, list) else []:
                if isinstance(item, dict) and cls._today(item, now):
                    k=cls._text(item).lower()
                    if k and k not in seen: seen.add(k); out.append(item)
        return out

    @classmethod
    def _today_releases(cls, news, now):
        out=[]; seen=set()
        for key in ("recent_events", "upcoming_events"):
            bucket = news.get(key, [])
            for item in bucket if isinstance(bucket, list) else []:
                if not isinstance(item, dict) or not cls._today(item, now): continue
                ident=str(item.get("id") or item.get("title") or "").lower()
                if ident not in seen: seen.add(ident); out.append(item)
        return out

    @staticmethod
    def _today(item, now):
        for key in ("published_at", "published", "time", "scheduled_time", "timestamp", "date"):
            value=item.get(key)
            if not value: continue
            try:
                d=value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
                return d.astimezone(timezone.utc).date() == now.date()
            except (TypeError,ValueError): pass
        return False

    @staticmethod
    def _currency(item):
        c=str(item.get("currency", item.get("ccy", "")) or "").upper()
        if c in {"GBP", "USD"}: return c
        t=TodayOnlyBiasEngine._text(item).lower()
        if any(x in t for x in ("boe", "bank of england", "sterling", "pound", "uk ", "britain")): return "GBP"
        if any(x in t for x in ("fed", "federal reserve", "dollar", "us ", "u.s.", "dxy")): return "USD"
        return ""

    @staticmethod
    def _text(item): return str(item.get("title", item.get("event", "")) or "").strip()

    @classmethod
    def _headline_direction(cls, c, title):
        t=title.lower(); pos=cls.GBP_POS if c=="GBP" else cls.USD_POS; neg=cls.GBP_NEG if c=="GBP" else cls.USD_NEG
        p=sum(x in t for x in pos); n=sum(x in t for x in neg)
        return 0 if p==n else 1 if p>n else -1

    @staticmethod
    def _source_weight(item):
        s=str(item.get("source", item.get("provider", ""))).lower()
        return 1.25 if any(x in s for x in ("reuters", "bloomberg", "financial times", "wsj")) else 1.10 if any(x in s for x in ("cnbc", "ft", "ing")) else 0.80 if any(x in s for x in ("google news", "gdelt")) else 1.0

    @staticmethod
    def _impact(event): return {"high":1.0,"medium":.85,"low":.6}.get(str(event.get("impact", "")).lower(), .8)

    @staticmethod
    def _surprise(event):
        try: a=float(event.get("actual")); f=float(event.get("forecast"))
        except (TypeError,ValueError): return None
        return None if f==0 else max(-2,min(2,(a-f)/max(abs(f),1)))

    @staticmethod
    def _previous_surprise(event):
        try: a=float(event.get("actual")); p=float(event.get("previous"))
        except (TypeError,ValueError): return None
        return None if p==0 else max(-2,min(2,(a-p)/max(abs(p),1)))

    @staticmethod
    def _quote(markets, keys):
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
    def _resolve(score, evidence):
        if evidence == 0: return "NEUTRAL"
        if score >= 0.65: return "BULLISH"
        if score <= -0.65: return "BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _confidence(score, evidence):
        return 0 if evidence == 0 else max(20, min(92, int(abs(score)*10 + evidence*6)))
