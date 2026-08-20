import { useMemo, useState } from "react";
import { usePAL } from "../hooks/usePAL";

function tone(value: unknown) {
  const bias = String(value ?? "UNKNOWN").toUpperCase();
  if (bias.includes("BULL")) return "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300";
  if (bias.includes("BEAR")) return "border-red-300/20 bg-red-300/[.07] text-red-300";
  return "border-amber-300/20 bg-amber-300/[.07] text-amber-300";
}

function textValue(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function eventTitle(item: Record<string, unknown>) {
  return textValue(item.title ?? item.name ?? item.event ?? item.headline, "Macro event");
}

export default function MacroRegimePanel() {
  const { data, isLoading } = usePAL();
  const [open, setOpen] = useState(false);

  const macro = data?.report?.macro;

  const evidence = useMemo(() => {
    if (!macro) return [] as Array<{ source: string; title: string; detail: string }>;

    const rows: Array<{ source: string; title: string; detail: string }> = [];

    const reasonSets: Array<[string, unknown]> = [
      ["DXY regime", macro.dxy?.reasons],
      ["GBP regime", macro.gbp?.reasons],
      ["GBP/USD regime", macro.gbpusd?.reasons],
    ];

    for (const [source, values] of reasonSets) {
      if (!Array.isArray(values)) continue;
      for (const reason of values.slice(0, 3)) {
        const title = String(reason ?? "").trim();
        if (title) rows.push({ source, title, detail: "Regime reasoning" });
      }
    }

    for (const item of [...(macro.news ?? []), ...(macro.high_impact ?? [])].slice(0, 6)) {
      const source = textValue(item.source ?? item.provider, "News");
      rows.push({
        source,
        title: eventTitle(item),
        detail: textValue(item.impact ?? item.published_at ?? item.published, "Current macro evidence"),
      });
    }

    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = `${row.source}|${row.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [macro]);

  const events = useMemo(() => {
    if (!macro) return [] as Array<Record<string, unknown>>;
    return (macro.events ?? []).slice(0, 5);
  }, [macro]);

  if (isLoading || !macro) return null;

  const confidence = Number(macro.confidence ?? 0);

  return (
    <div className="pointer-events-none fixed right-5 top-24 z-[180] hidden w-[min(420px,calc(100vw-32px))] lg:block">
      <div className="pointer-events-auto rounded-3xl border border-white/[.08] bg-[#07110f]/94 shadow-[0_30px_100px_rgba(0,0,0,.58)] backdrop-blur-xl">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-5 py-4 text-left">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">Macro Intelligence</div>
            <div className="mt-1 text-[11px] text-zinc-400">Broader regime · separate from TODAY</div>
          </div>
          <div className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2 text-[9px] font-semibold text-zinc-300">{open ? "Hide" : "Open"} ↓</div>
        </button>

        <div className="border-t border-white/[.06] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="text-xs font-semibold text-white">{textValue(macro.headline, "Macro conditions are being monitored.")}</div><p className="mt-2 text-[10px] leading-5 text-zinc-500">{textValue(macro.summary, "No high-confidence macro catalyst is active right now.")}</p></div>
            <div className="shrink-0 rounded-full border border-white/[.07] bg-white/[.025] px-2.5 py-1.5 text-[8px] uppercase tracking-[.16em] text-zinc-600">{confidence > 0 ? `${confidence}%` : "NO SCORE"}</div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[["DXY", macro.dxy?.bias], ["GBP", macro.gbp?.bias], ["GBP/USD", macro.gbpusd?.bias]].map(([label, bias]) => (
              <div key={String(label)} className="rounded-2xl border border-white/[.06] bg-black/20 p-3">
                <div className="text-[8px] uppercase tracking-[.16em] text-zinc-600">{label}</div>
                <div className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${tone(bias)}`}>{String(bias ?? "UNKNOWN")}</div>
                <div className="mt-2 text-[8px] text-zinc-700">{Number((macro as any)[String(label).toLowerCase().replace("/", "")]?.confidence ?? 0)}% confidence</div>
              </div>
            ))}
          </div>

          {open ? (
            <div className="mt-4 space-y-4">
              {evidence.length ? (
                <div>
                  <div className="mb-2 text-[8px] font-semibold uppercase tracking-[.2em] text-zinc-700">Confirmed evidence</div>
                  <div className="space-y-2">
                    {evidence.slice(0, 6).map((item, index) => (
                      <div key={`${item.source}-${index}`} className="rounded-xl border border-white/[.05] bg-white/[.02] p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-[8px] uppercase tracking-[.15em] text-cyan-300/70">{item.source}</span><span className="text-[8px] text-zinc-700">{item.detail}</span></div>
                        <div className="mt-1 text-[10px] leading-5 text-zinc-400">{item.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300/10 bg-amber-300/[.03] p-3 text-[10px] leading-5 text-zinc-500">No high-confidence macro catalyst is active right now. PAL will keep the broader regime neutral until stronger evidence appears.</div>
              )}

              {events.length ? (
                <div>
                  <div className="mb-2 text-[8px] font-semibold uppercase tracking-[.2em] text-zinc-700">Upcoming macro risk</div>
                  <div className="space-y-2">{events.map((item, index) => <div key={`event-${index}`} className="rounded-xl border border-amber-300/10 bg-amber-300/[.025] p-3"><div className="text-[10px] font-medium text-zinc-300">{eventTitle(item)}</div><div className="mt-1 text-[8px] text-zinc-700">Context/risk, not an automatic direction signal.</div></div>)}</div>
                </div>
              ) : null}

              <div className="rounded-xl border border-white/[.05] bg-white/[.02] p-3 text-[9px] leading-5 text-zinc-600">{textValue(macro.main_risk, "No major scheduled macro catalyst currently identified.")}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
