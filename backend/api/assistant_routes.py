import json
import os
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ai import ask_ai

router = APIRouter(prefix="/pal/assistant", tags=["PAL AI Assistant"])


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)


def _bias(value: Any) -> str:
    text = str(value or "UNKNOWN").upper()
    if "BULL" in text:
        return "BULLISH"
    if "BEAR" in text:
        return "BEARISH"
    if "NEUTRAL" in text:
        return "NEUTRAL"
    return text or "UNKNOWN"


def _journal_trades(context: dict[str, Any]) -> list[dict[str, Any]]:
    trades = context.get("journal") or []
    return [trade for trade in trades if isinstance(trade, dict)]


def _journal_answer(question: str, context: dict[str, Any]) -> str | None:
    if str(context.get("page") or "dashboard") != "journal":
        return None
    q = question.lower()
    journal_intent = any(
        x in q
        for x in (
            "journal", "trade history", "recent trades", "completed trades", "my trades",
            "execution", "executions", "entry", "exit", "risk management", "discipline",
            "trade quality", "weak", "weakness", "best trade", "worst trade", "p&l",
            "profit", "loss",
        )
    )
    if not journal_intent:
        return None
    trades = _journal_trades(context)
    if not trades:
        return "I don't have completed journal trades in the supplied PAL context. I can still answer the market/macro question, but I can't make a trade-history judgment until journal records are supplied."
    today = context.get("today") or {}
    macro = context.get("macro") or {}
    pair_bias = _bias(((today.get("today") or {}).get("gbpusd") or {}).get("bias") or ((macro.get("gbpusd") or {}).get("bias")))
    dxy_bias = _bias(((today.get("today") or {}).get("dxy") or {}).get("bias") or ((macro.get("dxy") or {}).get("bias")))
    wins = sum(1 for t in trades if str(t.get("result", "")).upper() in {"WIN", "WON", "PROFIT"} or float(t.get("net_profit") or 0) > 0)
    losses = sum(1 for t in trades if str(t.get("result", "")).upper() in {"LOSS", "LOST", "LOSE"} or float(t.get("net_profit") or 0) < 0)
    breakeven = len(trades) - wins - losses
    net = sum(float(t.get("net_profit") or 0) for t in trades)
    win_rate = wins / len(trades) * 100
    if any(x in q for x in ("review", "trade history", "recent trades", "history", "my trades", "p&l")):
        return f"Journal review: {len(trades)} completed trade(s), {wins} win(s), {losses} loss(es), {breakeven} breakeven, win rate {win_rate:.1f}%, net P&L {net:.2f}. This is based only on the supplied journal records; it does not infer missing setup rules or reasons for entry."
    if any(x in q for x in ("conflict", "market data", "market alignment", "aligned", "alignment")):
        conflicts = []
        for trade in trades:
            symbol = str(trade.get("symbol") or "").upper()
            direction = str(trade.get("direction") or "").upper()
            if symbol in {"GBPUSD", "GBP/USD"} and direction:
                if pair_bias == "BULLISH" and direction in {"SELL", "SHORT"}:
                    conflicts.append(f"{symbol} {direction} trade conflicts with today's GBP/USD bullish bias")
                elif pair_bias == "BEARISH" and direction in {"BUY", "LONG"}:
                    conflicts.append(f"{symbol} {direction} trade conflicts with today's GBP/USD bearish bias")
        if conflicts:
            return "Potential market-alignment conflicts found: " + "; ".join(conflicts) + f". Today's DXY bias: {dxy_bias}."
        return f"I don't see a direct GBP/USD direction conflict in the supplied trades. Today's GBP/USD bias is {pair_bias} and today's DXY bias is {dxy_bias}. This checks direction only; it cannot verify ICT/FVG/CISD rules because those fields are not present in the journal data."
    if any(x in q for x in ("execution", "weak", "weakness", "quality", "entry", "exit", "risk management", "discipline")):
        missing = [field for field in ("stop_loss", "take_profit", "comment") if not any(t.get(field) not in (None, "", 0) for t in trades)]
        best = max(trades, key=lambda t: float(t.get("net_profit") or 0))
        worst = min(trades, key=lambda t: float(t.get("net_profit") or 0))
        result = f"Execution evidence: {len(trades)} trades, net P&L {net:.2f}. Best recorded trade: {best.get('symbol', 'unknown')} {best.get('direction', '')} ({float(best.get('net_profit') or 0):.2f}); worst: {worst.get('symbol', 'unknown')} {worst.get('direction', '')} ({float(worst.get('net_profit') or 0):.2f}). "
        if missing:
            return result + "The journal is missing " + ", ".join(missing) + ", so I cannot objectively score stop/target placement or the stated trade rationale."
        return result + "The available journal fields can be used for a more detailed execution review."
    return None


def _fallback(question: str, context: dict[str, Any]) -> str:
    journal_result = _journal_answer(question, context)
    if journal_result:
        return journal_result
    today_layer = context.get("today") or {}
    today = today_layer.get("today") or {}
    macro = context.get("macro") or {}
    pair = _bias((today.get("gbpusd") or {}).get("bias"))
    dxy = _bias((today.get("dxy") or {}).get("bias"))
    gbp = _bias((today.get("gbp") or {}).get("bias"))
    macro_pair = _bias((macro.get("gbpusd") or {}).get("bias"))
    macro_dxy = _bias((macro.get("dxy") or {}).get("bias"))
    summary = str(today.get("reasons") or macro.get("summary") or context.get("summary") or "No current PAL summary is available.")
    news = context.get("news") or []
    events = context.get("events") or []
    q = question.lower()
    if any(x in q for x in ("macro regime", "broader macro", "longer term macro")):
        return f"Broader macro regime: GBP/USD {macro_pair}, DXY {macro_dxy}. This is separate from today's bias."
    if any(x in q for x in ("news", "headline", "headlines", "what happened", "latest")):
        headlines = [str(item.get("title") or item.get("headline") or item.get("name")) for item in news[:5] if isinstance(item, dict) and (item.get("title") or item.get("headline") or item.get("name"))]
        return ("News relevant to today's PAL view: " + "; ".join(headlines) + f". Today's GBP/USD bias is {pair}; DXY is {dxy}.") if headlines else f"No news headlines were supplied to PAL right now. Today's GBP/USD is {pair}, DXY {dxy}, GBP {gbp}."
    if any(x in q for x in ("calendar", "event", "events", "economic release", "what data")):
        titles = [str(item.get("title") or item.get("name") or item.get("event")) for item in events[:6] if isinstance(item, dict) and (item.get("title") or item.get("name") or item.get("event"))]
        return "Upcoming/current macro events in PAL: " + "; ".join(titles) + "." if titles else "No scheduled macro events were supplied to PAL in the current context."
    if any(x in q for x in ("bias", "bullish", "bearish", "neutral", "direction")):
        return f"Today's evidence: GBP/USD {pair}, DXY {dxy}, GBP {gbp}. {summary} PAL does not invent conviction when evidence is insufficient."
    if any(x in q for x in ("brief", "today", "what matters")):
        return f"Today's PAL brief: GBP/USD is {pair}; DXY is {dxy}; GBP is {gbp}. {summary}"
    return f"Today's PAL evidence: GBP/USD {pair}, DXY {dxy}, GBP {gbp}. Broader regime: GBP/USD {macro_pair}, DXY {macro_dxy}."


@router.post("")
def assistant(payload: AssistantRequest) -> dict[str, Any]:
    question = payload.question.strip()
    context = payload.context
    history = payload.history[-8:]
    page = str(context.get("page") or "dashboard")
    system = (
        "You are PAL, an evidence-first AI trading intelligence assistant. Answer the user's CURRENT question, not the previous question. "
        f"The user is currently on the {page} page. "
        "TODAY and MACRO are separate concepts: for questions about today/current trading day/current session, use context.today only; for broader macro/regime questions, use context.macro. Never substitute macro for missing TODAY data. "
        "Use ONLY supplied PAL context. Never fabricate prices, news, events, sources, or certainty. Upcoming events are risk/context, not automatic directional evidence. "
        "For journal/trade questions, compare trade details against today's supplied market context and explicitly flag conflicts. Do not infer missing stop-loss, take-profit, setup, or rationale fields. If evidence is missing, say so. Be concise but useful."
    )
    prompt = {"system": system, "question": question, "recent_conversation": history, "pal_context": context}
    if not os.getenv("OPENAI_API_KEY"):
        return {"success": True, "answer": _fallback(question, context), "provider": "structured-fallback"}
    try:
        answer = ask_ai(json.dumps(prompt, ensure_ascii=False, default=str))
        return {"success": True, "answer": answer, "provider": "openai"}
    except Exception as exc:
        print(f"PAL assistant AI failed: {exc}")
        return {"success": True, "answer": _fallback(question, context), "provider": "structured-fallback", "warning": "AI provider unavailable; answer limited to current PAL evidence."}
