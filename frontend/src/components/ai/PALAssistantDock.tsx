import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePAL } from "../../hooks/usePAL";
import { fetchJournal } from "../../api/journal";
import PALAssistant from "./PALAssistant";

export default function PALAssistantDock() {
  const { data } = usePAL();
  const [page, setPage] = useState(() => window.location.hash.replace(/^#/, "") || "dashboard");

  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash.replace(/^#/, "") || "dashboard");
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const journalQuery = useQuery({ queryKey: ["pal-assistant-journal", 365], queryFn: () => fetchJournal(365), enabled: page === "journal", staleTime: 15000, refetchInterval: false });

  const context = useMemo(() => ({
    page,
    macro: data?.report?.macro ?? null,
    news: data?.report?.news ?? null,
    summary: data?.report?.summary ?? null,
    market_snapshot: data?.report?.macro?.markets ?? null,
    journal: page === "journal" ? (journalQuery.data?.data?.trades ?? []) : undefined,
  }), [data, journalQuery.data, page]);

  const prompts = page === "journal"
    ? ["Review my trade history", "Which trades conflict with the market data?", "Track my execution quality", "Where was my execution weak?"]
    : ["What is today's brief?", "What news matters today?", "Explain the current bias", "Where should I look today?"];

  return <PALAssistant context={context} title="PAL Intelligence" subtitle={page === "journal" ? "Ask about your trades and the market" : "Ask about today's live evidence"} quickPrompts={prompts} accent={page === "journal" ? "emerald" : "cyan"} />;
}
