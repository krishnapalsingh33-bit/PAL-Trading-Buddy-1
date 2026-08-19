import { useMemo } from "react";
import { usePAL } from "../../hooks/usePAL";
import { useJournal } from "../../hooks/useJournal";
import PALAssistant from "./PALAssistant";

export default function PALAssistantDock() {
  const { data } = usePAL();
  const { data: journal } = useJournal(365);
  const page = window.location.hash.replace(/^#/, "") || "dashboard";

  const context = useMemo(() => ({
    page,
    macro: data?.report?.macro ?? null,
    news: data?.report?.news ?? null,
    summary: data?.report?.summary ?? null,
    market_snapshot: data?.report?.macro?.markets ?? null,
    journal: page === "journal" ? (journal?.data?.trades ?? []) : undefined,
  }), [data, journal, page]);

  const prompts = page === "journal"
    ? ["Review my recent trades", "Which trades conflict with the market data?", "Where was my execution weak?"]
    : ["What is today's brief?", "Explain the current bias", "What news matters today?", "Where should I look today?"];

  return <PALAssistant context={context} title="PAL Intelligence" subtitle={page === "journal" ? "Ask about your trades and the market" : "Ask about today's live evidence"} quickPrompts={prompts} accent={page === "journal" ? "emerald" : "cyan"} />;
}
