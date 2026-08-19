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

  const isJournal = page === "journal";
  const journalQuery = useQuery({
    queryKey: ["pal-assistant-journal", 365],
    queryFn: () => fetchJournal(365),
    enabled: isJournal,
    staleTime: 15000,
    refetchInterval: false,
  });

  const context = useMemo(() => ({
    page: isJournal ? "journal" : "dashboard",
    // TODAY and MACRO are separate inputs. PAL must not infer TODAY from MACRO.
    today: data?.report?.today ?? null,
    macro: data?.report?.macro ?? null,
    news: data?.report?.news ?? null,
    summary: data?.report?.summary ?? null,
    market_snapshot: data?.report?.macro?.markets ?? null,
    journal: isJournal ? (journalQuery.data?.data?.trades ?? []) : undefined,
  }), [data, journalQuery.data, isJournal]);

  const prompts = isJournal
    ? ["Review my trade history", "Which trades conflict with today's bias?", "Track my execution quality", "Where was my execution weak?"]
    : ["What is today's brief?", "What news matters today?", "Explain today's bias", "What is the broader macro regime?"];

  return (
    <PALAssistant
      key={isJournal ? "journal-assistant" : "dashboard-assistant"}
      context={context}
      title="PAL Intelligence"
      subtitle={isJournal ? "Ask about your trades and today's market evidence" : "Ask about today's live evidence or broader macro"}
      quickPrompts={prompts}
      accent={isJournal ? "emerald" : "cyan"}
    />
  );
}
