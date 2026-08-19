import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ai import ask_ai

router = APIRouter(prefix="/pal/assistant", tags=["PAL AI Assistant"])


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)


def _fallback(question: str, context: dict[str, Any]) -> str:
    macro = context.get("macro") or {}
    pair = str((macro.get("gbpusd") or {}).get("bias", "UNKNOWN")).upper()
    dxy = str((macro.get("dxy") or {}).get("bias", "UNKNOWN")).upper()
    gbp = str((macro.get("gbp") or {}).get("bias", "UNKNOWN")).upper()
    summary = str(macro.get("summary") or "No current macro summary is available.")
    news = macro.get("news") or []
    events = macro.get("events") or []
    q = question.lower()

    if any(x in q for x in ("brief", "today", "what matters")):
        lines = [f"Today's PAL brief: GBP/USD is {pair}; DXY is {dxy}; GBP is {gbp}.", summary]
        if events:
            lines.append("Key scheduled events: " + "; ".join(str(e.get("title") or e.get("name") or e.get("event") or "Macro event") for e in events[:4] if isinstance(e, dict)))
        if news:
            lines.append("Recent news is available in the Macro Intelligence / News Stories panels.")
        return " ".join(lines)

    if "bias" in q or "bullish" in q or "bearish" in q or "neutral" in q:
        return f"Current evidence: GBP/USD {pair}, DXY {dxy}, GBP {gbp}. {summary} PAL will keep the bias neutral/unknown when the evidence is not strong enough; it should not invent conviction."

    return f"I can answer from the current PAL evidence, but the configured AI provider is unavailable. Current GBP/USD bias: {pair}. DXY: {dxy}. GBP: {gbp}. {summary}"


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
