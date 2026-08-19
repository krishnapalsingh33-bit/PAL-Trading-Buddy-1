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
    return text


def _journal_trades(context: dict[str, Any]) -> list[dict[str, Any]]:
    trades = context.get("journal") or []
    return [trade for trade in trades if isinstance(trade, dict)]


def _journal_answer(question: str, context: dict[str, Any]) -> str | None:
    trades = _journal_trades(context)
    if not trades:
        return "I don't have any completed journal trades in the supplied PAL context, so I can't make a trade-history judgment yet."

    q = question.lower()
    macro = context.get("macro") or {}
    pair_bias = _bias((macro.get("gbpusd") or {}).get("bias"))
    dxy_bias = _bias((macro.get("dxy") or {}).get("bias"))

    wins = sum(1 for t in trades if str(t.get("result", "")).upper() in {"WIN", "WON", "PROFIT"} or float(t.get("net_profit") or 0) > 0)
    losses = sum(1 for t in trades if str(t.get("result", "")).upper() in {"LOSS", "LOST", "LOSE"} or float(t.get("net_profit") or 0) < 0)
    breakeven = len(trades) - wins - losses
    net = sum(float(t.get("net_profit") or 0) for t in trades)
    win_rate = (wins / len(trades) * 100) if trades else 0

    if any(x in q for x in ("review", "trade history", "recent trades", "history")):
        return (
            f"Journal review: {len(trades)} completed trade(s), {wins} win(s), {losses} loss(es), "
            f"{breakeven} breakeven, win rate {win_rate:.1f}%, net P&L {net:.2f}. "
            "This is based only on the supplied journal records; it does not infer missing execution rules or reasons for entry."
        )

    if any(x in q for x in ("conflict", "market data", "market")):
        conflicts: list[str] = []
        for trade in trades:
            symbol = str(trade.get("symbol") or "").upper()
            direction = str(trade.get("direction") or "").upper()
            if symbol in {"GBPUSD", "GBP/USD"} and direction:
                if pair_bias == "BULLISH" and direction in {"SELL", "SHORT"}:
                    conflicts.append(f"{symbol} {direction} trade conflicts with GBP/USD bullish macro bias")
                elif pair_bias == "BEARISH" and direction in {"BUY", "LONG"}:
                    conflicts.append(f"{symbol} {direction} trade conflicts with GBP/USD bearish macro bias")
        if conflicts:
            return "Potential market-alignment conflicts found: " + "; ".join(conflicts) + f". Current DXY bias: {dxy_bias}."
        return f"I don't see a direct GBP/USD direction conflict in the supplied trades. Current GBP/USD bias is {pair_bias} and DXY bias is {dxy_bias}. This checks direction only; it cannot verify your ICT/FVG/CISD rules because those fields are not present in the journal data."

    if any(x in q for x in ("execution", "weak", "quality")):
        missing = []
        for field in ("stop_loss", "take_profit", "comment"):
            if not any(t.get(field) not in (None, "", 0) for t in trades):
                missing.append(field)
        best = max(trades, key=lambda t: float(t.get("net_profit") or 0))
        worst = min(trades, key=lambda t: float(t.get("net_profit") or 0))
        result = (
            f"Execution evidence: {len(trades)} trades, net P&L {net:.2f}. Best recorded trade: {best.get('symbol', 'unknown')} "
            f"{best.get('direction', '')} ({float(best.get('net_profit') or 0):.2f}); worst: {worst.get('symbol', 'unknown')} "
            f"{worst.get('direction', '')} ({float(worst.get('net_profit') or 0):.2f}). "
        )
        if missing:
            result += "The journal is missing " + ", ".join(missing) + ", so I cannot objectively score stop/target placement or the stated trade rationale."
        else:
            result += "The available fields can be used for a more detailed execution review."
        return result

    return None


def _fallback(question: str, context: dict[str, Any]) -> str:
    journal_result = _journal_answer(question, context)
    if journal_result:
        return journal_result

    macro = context.get("macro") or {}
    pair = _bias((macro.get("gbpusd") or {}).get("bias"))
    dxy = _bias((macro.get("dxy") or {}).get("bias"))
    gbp = _bias((macro.get("gbp") or {}).get("bias"))
    summary = str(macro.get("summary") or "No current macro summary is available.")
    news = macro.get("news") or []
    events = macro.get("events") or []
    q = question.lower()

    if any(x in q for x in ("brief", "today", "what matters")):
        lines = [f"Today's PAL brief: GBP/USD is {pair}; DXY is {dxy}; GBP is {gbp}.", summary]
        if events:
            titles = [str(e.get("title") or e.get("name") or e.get("event") or "Macro event") for e in events[:4] if isinstance(e, dict)]
            if titles:
                lines.append("Key scheduled events: " + "; ".join(titles))
        if news:
            lines.append("Recent news is available in the Macro Intelligence / News Stories panels.")
        return " ".join(lines)

    if "bias" in q or "bullish" in q or "bearish" in q or "neutral" in q:
        return f"Current evidence: GBP/USD {pair}, DXY {dxy}, GBP {gbp}. {summary} PAL will keep the bias neutral/unknown when the evidence is not strong enough; it should not invent conviction."

    return f"I can answer from the current PAL evidence. GBP/USD bias: {pair}. DXY: {dxy}. GBP: {gbp}. {summary}"


@router.post("")
def assistant(payload: AssistantRequest) -> dict[str, Any]:
    question = payload.question.strip()
    context = payload.context
    history = payload.history[-8:]
    system = (
        "You are PAL, an evidence-first AI trading intelligence assistant. "
        "Use ONLY the supplied PAL context. Never fabricate prices, news, events, sources, or certainty. "
        "Explain what evidence supports or contradicts a bias, what matters today, and where the user can inspect the evidence in PAL. "
        "For journal/trade questions, compare the trade details against the supplied market/macro/news context and explicitly flag conflicts. "
        "For execution-quality questions, do not infer missing stop-loss, take-profit, setup, or rationale fields. "
        "Do not give personalized financial instructions or guarantee outcomes. If evidence is missing, say so. "
        "Be concise but useful, using clear sections when appropriate."
    )
    prompt = {
        "system": system,
        "question": question,
        "recent_conversation": history,
        "pal_context": context,
    }

    if not os.getenv("OPENAI_API_KEY"):
        return {"success": True, "answer": _fallback(question, context), "provider": "structured-fallback"}

    try:
        answer = ask_ai(json.dumps(prompt, ensure_ascii=False, default=str))
        return {"success": True, "answer": answer, "provider": "openai"}
    except Exception as exc:
        print(f"PAL assistant AI failed: {exc}")
        return {"success": True, "answer": _fallback(question, context), "provider": "structured-fallback", "warning": "AI provider unavailable; answer limited to current PAL evidence."}
