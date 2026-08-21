from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo


class TodayOnlyBiasEngine:
    """Independent TODAY-only GBP/USD bias engine with transparent evidence buckets."""

    ZONES = {"Asia": "Asia/Tokyo", "London": "Europe/London", "New York": "America/New_York"}
    GBP_POS = ("hawkish boe", "boe rate hike", "boe hikes", "boe tightening", "uk inflation rises", "uk inflation rose", "uk inflation jumps", "uk inflation jumped", "uk inflation accelerates", "uk inflation accelerated", "uk inflation remains elevated", "hot uk inflation", "strong uk growth", "uk growth accelerates", "strong uk economy", "uk employment strengthens", "unemployment falls", "uk wages accelerate", "wage growth accelerates", "strong retail sales", "sterling gains", "sterling strengthens", "sterling firm", "pound gains", "pound strengthens", "pound rises", "gbp gains")
    GBP_NEG = ("dovish boe", "boe rate cut", "boe cuts", "boe easing", "uk inflation falls", "uk inflation fell", "uk inflation drops", "uk inflation dropped", "cooling uk inflation", "soft uk inflation", "weak uk growth", "uk growth slows", "uk recession", "uk employment weakens", "uk wages slow", "wage growth slows", "unemployment rises", "weak retail sales", "sterling falls", "sterling drops", "sterling weakens", "pound falls", "pound drops", "gbp falls")
    USD_POS = ("hawkish fed", "hawkish federal reserve", "fed rate hike", "fed hikes", "higher for longer", "fed tightening", "rate hike bets rise", "strong us inflation", "hot us inflation", "us inflation rises", "us inflation rose", "sticky us inflation", "strong us jobs", "strong us payrolls", "strong employment", "falling unemployment", "strong retail sales", "strong us growth", "us growth accelerates", "dollar gains", "dollar rises", "dollar strengthens", "dollar firms")
    USD_NEG = ("dovish fed", "dovish federal reserve", "fed rate cut", "fed cuts", "fed easing", "rate cut bets rise", "rate cut expectations rise", "rate hike bets fade", "weak us inflation", "soft us inflation", "cooling us inflation", "us inflation falls", "us inflation fell", "weak us jobs", "weak us payrolls", "weak employment", "rising unemployment", "weak retail sales", "weak us growth", "us growth slows", "economic slowdown", "dollar falls", "dollar drops", "dollar softens", "dollar softened", "dollar slips", "dollar slipped", "dollar declines", "dollar declined", "dollar weakens", "dollar weakened")
    LOWER_IS_BETTER = ("unemployment", "jobless claims", "initial jobless claims", "continuing claims")

    def build(self, _macro_bias: dict[str, Any], news: dict[str, Any], now: datetime) -> dict[str, Any]:
        now = now.astimezone(timezone.utc)
        gbp = usd = 0.0
        components = {
            "gbp_news": 0.0,
            "usd_news": 0.0,
            "gbp_data": 0.0,
            "usd_data": 0.0,
            "gbpusd_market": 0.0,
            "dxy_market": 0.0,
        }
        evidence = 0
        reasons: list[str] = []

        for item in self._today_news(news, now):
            c = self._currency(item); title = self._text(item)
            if c not in {"GBP", "USD"} or not title:
                continue
            direction = self._headline_direction(c, title)
            if direction == 0:
                continue
            weight = self._source_weight(item)
            score = direction * weight
            if c == "GBP":
                gbp += score
                components["gbp_news"] += score
            else:
                usd += score
                components["usd_news"] += score
            evidence += 1
            reasons.append(f"{c}: {title}")

        for event in self._today_releases(news, now):
            c = self._currency(event); surprise = self._surprise(event)
            if c not in {"GBP", "USD"}:
                continue
            title = self._text(event).lower()
            if surprise is None:
                continue
            if any(x in title for x in self.LOWER_IS_BETTER):
                surprise = -surprise
            if abs(surprise) < 0.0001:
                surprise = self._previous_surprise(event)
                if surprise is None:
                    continue
            score = max(-2.0, min(2.0, surprise * 1.5 * self._impact(event)))
            if c == "GBP":
                gbp += score
                components["gbp_data"] += score
            else:
                usd += score
                components["usd_data"] += score
            evidence += 1
            reasons.append(f"{c} data: {self._text(event) or 'economic release'} (actual {event.get('actual')} vs forecast {event.get('forecast')}, previous {event.get('previous')})")

        markets = news.get("markets") or {}
        pair_change = self._change(self._quote(markets, ("GBPUSD", "GBP/USD")))
        dxy_change = self._change(self._quote(markets, ("DXY",)))
        if pair_change is not None:
            score = max(-1, min(1, pair_change / .50)) * .35
            gbp += score
            components["gbpusd_market"] += score
            evidence += 1
            reasons.append(f"GBP/USD today: {pair_change:+.2f}%")
        if dxy_change is not None:
            score = max(-1, min(1, dxy_change / .50)) * .35
            usd += score
            components["dxy_market"] += score
            evidence += 1
            reasons.append(f"DXY today: {dxy_change:+.2f}%")

        gbp, usd = max(-5, min(5, gbp)), max(-5, min(5, usd))
        pair = max(-10, min(10, gbp - usd))

        for event in self._upcoming(news)[:3]:
            c = self._currency(event); minutes = event.get("minutes")
            if c in {"GBP", "USD"} and isinstance(minutes, (int, float)) and 0 <= minutes <= 180:
                reasons.append(f"Upcoming {c} catalyst in {int(minutes)}m: {self._text(event) or 'macro event'}")

        sessions = {}
        for name in ("Asia", "London", "New York"):
            s = pair
            if name == "London": s = pair * .75 + gbp * .25
            if name == "New York": s = pair * .75 - usd * .25
            sessions[name] = {
                "active": self._open(name, now),
                "bias": self._resolve(s, evidence),
                "score": round(s, 2),
                "confidence": self._confidence(s, evidence),
                "reasons": reasons[:4],
                "updated_at": now.isoformat(),
            }

        rounded_components = {key: round(value, 2) for key, value in components.items()}
        net_evidence = round(gbp - usd, 2)
        return {
            "today": {
                "bias": self._resolve(pair, evidence),
                "dxy": {"bias": self._resolve(usd, evidence), "score": round(usd, 2)},
                "gbp": {"bias": self._resolve(gbp, evidence), "score": round(gbp, 2)},
                "gbpusd": {"bias": self._resolve(pair, evidence), "score": round(pair, 2)},
                "score": round(pair, 2),
                "confidence": self._confidence(pair, evidence),
                "reasons": reasons[:8],
                "evidence_count": evidence,
                "components": rounded_components,
                "net_currency_score": net_evidence,
                "scope": "TODAY_ONLY",
                "source": "today_news_calendar_market_data",
                "updated_at": now.isoformat(),
            },
            "sessions": sessions,
            "active_session": next((n for n, x in sessions.items() if x["active"]), None),
        }

    @staticmethod
    def _today_news(news, now):
        out=[]; seen=set()
        for key in ("headlines", "gbp", "usd"):
            bucket = news.get(key, [])
            for item in bucket if isinstance(bucket, list) else []:
                if not isinstance(item, dict) or not TodayOnlyBiasEngine._today(item, now):
                    continue
                k=TodayOnlyBiasEngine._text(item).lower()
                if k and k not in seen:
                    seen.add(k); out.append(item)
        return out

    @staticmethod
    def _today_releases(news, now):
        out=[]; seen=set()
        for key in ("recent_events", "events"):
            bucket = news.get(key, [])
            for item in bucket if isinstance(bucket, list) else []:
                if not isinstance(item, dict) or not TodayOnlyBiasEngine._today(item, now):
                    continue
                ident=str(item.get("id") or item.get("title") or "").lower()
                if ident not in seen:
                    seen.add(ident); out.append(item)
        return out

    @staticmethod
    def _today(item, now):
        for key in ("published_at", "published", "time", "scheduled_time", "timestamp", "date"):
            value=item.get(key)
            if not value:
                continue
            try:
                d=datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                d=d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
                return d.astimezone(timezone.utc).date() == now.date()
            except (TypeError, ValueError):
                pass
        return False

    @staticmethod
    def _currency(item):
        c=str(item.get("currency", item.get("ccy", "")) or "").upper()
        if c in {"GBP", "USD"}:
            return c
        t=TodayOnlyBiasEngine._text(item).lower()
        if any(x in t for x in ("boe", "bank of england", "sterling", "pound", "uk ", "britain", "uk inflation")):
            return "GBP"
        if any(x in t for x in ("fed", "federal reserve", "dollar", "us ", "u.s.", "dxy")):
            return "USD"
        return ""

    @staticmethod
    def _text(item):
        return str(item.get("title", item.get("event", "")) or "").strip()

    @staticmethod
    def _headline_direction(c, title):
        t=title.lower()
        pos=TodayOnlyBiasEngine.GBP_POS if c=="GBP" else TodayOnlyBiasEngine.USD_POS
        neg=TodayOnlyBiasEngine.GBP_NEG if c=="GBP" else TodayOnlyBiasEngine.USD_NEG
        p=sum(x in t for x in pos); n=sum(x in t for x in neg)
        return 0 if p==n else (1 if p>n else -1)

    @staticmethod
    def _source_weight(item):
        s=str(item.get("source", item.get("provider", ""))).lower()
        return 1.25 if any(x in s for x in ("reuters", "bloomberg", "financial times", "wsj")) else (1.1 if any(x in s for x in ("cnbc", "ft", "ing")) else 1.0)

    @staticmethod
    def _impact(event):
        return {"high":1.0,"medium":.85,"low":.6}.get(str(event.get("impact", "")).lower(), .8)

    @staticmethod
    def _surprise(event):
        try: a,f=float(event.get("actual")),float(event.get("forecast"))
        except (TypeError,ValueError): return None
        return None if f==0 else max(-2,min(2,(a-f)/max(abs(f),1)))

    @staticmethod
    def _previous_surprise(event):
        try: a,p=float(event.get("actual")),float(event.get("previous"))
        except (TypeError,ValueError): return None
        if p == 0: return None
        return max(-2,min(2,(a-p)/max(abs(p),1)))

    @staticmethod
    def _upcoming(news):
        v=news.get("upcoming_events", []); return v if isinstance(v, list) else []

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
    def _resolve(s, evidence=0):
        if evidence == 0:
            return "NEUTRAL"
        if s >= 0.65:
            return "BULLISH"
        if s <= -0.65:
            return "BEARISH"
        return "NEUTRAL"

    @staticmethod
    def _confidence(s,e):
        return 10 if e==0 else max(20,min(90,int(abs(s)*10+e*6)))
