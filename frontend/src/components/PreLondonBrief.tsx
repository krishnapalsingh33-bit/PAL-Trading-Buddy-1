import { useMemo } from "react";

type BriefProps = {
  report: any;
};

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" | "WARMING UP";

function bias(value: unknown): Bias {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("BULL")) return "BULLISH";
  if (raw.includes("BEAR")) return "BEARISH";
  if (raw.includes("WARM")) return "WARMING UP";
  if (raw === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function biasClass(value: Bias) {
  if (value === "BULLISH") return "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.06]";
  if (value === "BEARISH") return "text-red-300 border-red-300/20 bg-red-300/[.06]";
  if (value === "WARMING UP") return "text-cyan-300 border-cyan-300/20 bg-cyan-300/[.05]";
  return "text-amber-300 border-amber-300/20 bg-amber-300/[.05]";
}

function impactClass(value: unknown) {
  const impact = String(value ?? "").toLowerCase();
  if (impact === "high") return "text-red-300 border-red-300/20 bg-red-300/[.05]";
  if (impact === "medium") return "text-amber-300 border-amber-300/20 bg-amber-300/[.05]";
  return "text-zinc-500 border-white/[.07] bg-white/[.02]";
}

function deriveRisk(events: any[], dxy: Bias, gbpusd: Bias) {
  const high = events.filter((event) => String(event?.impact ?? "").toLowerCase() === "high").length;
  const medium = events.filter((event) => String(event?.impact ?? "").toLowerCase() === "medium").length;
  if (high >= 2) return { label: "HIGH", className: "text-red-300 border-red-300/20 bg-red-300/[.07]", reason: `${high} high-impact catalysts are on the calendar.` };
  if (high === 1 || medium >= 3) return { label: "MEDIUM", className: "text-amber-300 border-amber-300/20 bg-amber-300/[.06]", reason: "There are meaningful catalysts around the session." };
  if (dxy === "WARMING UP" || gbpusd === "WARMING UP" || dxy === "UNKNOWN" || gbpusd === "UNKNOWN") return { label: "UNKNOWN", className: "text-cyan-300 border-cyan-300/20 bg-cyan-300/[.05]", reason: "Live market movement is still being collected." };
  return { label: "LOW", className: "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.06]", reason: "No unusually heavy event concentration is detected." };
}

function formatEventTime(event: any) {
  const raw = event?.scheduled_time ?? event?.time ?? event?.timestamp ?? event?.date;
  if (!raw) return "—";
  try { return new Date(raw).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return String(raw); }
}

export default function PreLondonBrief({ report }: BriefProps) {
  const todayContainer = report?.today ?? {};
  const today = todayContainer?.today ?? {};
  const markets = report?.markets ?? report?.macro?.markets ?? report?.market_data ?? {};
  const rightNow = today?.right_now ?? {};

  const dxy = bias(rightNow?.dxy?.bias);
  const gbpusd = bias(rightNow?.gbpusd?.bias);
  const dayBias = bias(today?.gbpusd?.bias);

  const events = useMemo(() => {
    const candidates = [
      ...(Array.isArray(report?.upcoming_events) ? report.upcoming_events : []),
      ...(Array.isArray(report?.news?.upcoming_events) ? report.news.upcoming_events : []),
      ...(Array.isArray(report?.events) ? report.events : []),
    ];
    const seen = new Set<string>();
    return candidates.filter((event) => {
      const key = `${event?.title ?? event?.event ?? ""}-${event?.scheduled_time ?? event?.time ?? ""}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const ai = String(a?.impact ?? "").toLowerCase();
      const bi = String(b?.impact ?? "").toLowerCase();
      return ({ high: 0, medium: 1, low: 2 }[ai] ?? 3) - ({ high: 0, medium: 1, low: 2 }[bi] ?? 3);
    }).slice(0, 5);
  }, [report]);

  const risk = deriveRisk(events, dxy, gbpusd);
  const pairChange = Number(markets?.GBPUSD?.change_percent);
  const dxyChange = Number(markets?.DXY?.change_percent);

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,.08),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,.025),rgba(255,255,255,.012))] p-5 lg:p-6 shadow-[0_25px_90px_-60px_rgba(34,211,238,.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /><span className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">PRE-LONDON BRIEF</span></div>
          <h2 className="mt-2 text-xl font-semibold text-white">Two-minute market environment</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600">General market context only. PAL keeps this separate from any private trading methodology.</p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase tracking-wider ${risk.className}`}>Risk · {risk.label}</div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Today's GBP/USD</div><div className={`mt-3 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${biasClass(dayBias)}`}>{dayBias}</div><div className="mt-3 text-[10px] text-zinc-600">Day confidence {Number(today?.confidence ?? 0)}%</div></div>
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">DXY · Right now</div><div className={`mt-3 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${biasClass(dxy)}`}>{dxy}</div><div className="mt-3 font-mono text-[10px] text-zinc-500">{Number.isFinite(dxyChange) ? `${dxyChange >= 0 ? "+" : ""}${dxyChange.toFixed(2)}% today` : "No daily quote"}</div></div>
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">GBP/USD · Right now</div><div className={`mt-3 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${biasClass(gbpusd)}`}>{gbpusd}</div><div className="mt-3 font-mono text-[10px] text-zinc-500">{Number.isFinite(pairChange) ? `${pairChange >= 0 ? "+" : ""}${pairChange.toFixed(2)}% today` : "No daily quote"}</div></div>
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Session</div><div className="mt-3 text-sm font-semibold text-white">London</div><div className="mt-2 text-[10px] text-zinc-600">{risk.reason}</div></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4">
          <div className="flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Upcoming catalysts</div><div className="mt-1 text-xs font-semibold text-white">Next relevant economic events</div></div><span className="text-[8px] uppercase tracking-wider text-zinc-700">General information</span></div>
          <div className="mt-3 space-y-2">
            {events.length ? events.map((event, index) => <div key={`${event?.title ?? event?.event}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.05] bg-white/[.018] px-3 py-2.5"><div className="min-w-0"><div className="truncate text-[10px] font-medium text-zinc-300">{event?.title ?? event?.event ?? "Economic event"}</div><div className="mt-1 text-[8px] uppercase tracking-wider text-zinc-600">{event?.currency ?? "—"} · {formatEventTime(event)}</div></div><span className={`shrink-0 rounded-lg border px-2 py-1 text-[8px] font-bold uppercase ${impactClass(event?.impact)}`}>{String(event?.impact ?? "unknown")}</span></div>) : <div className="rounded-xl border border-white/[.05] bg-white/[.018] px-3 py-4 text-[10px] text-zinc-600">No upcoming events are currently available from the backend feed.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4">
          <div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Quick read</div>
          <div className="mt-3 space-y-3 text-[10px] leading-5 text-zinc-500">
            <div className="rounded-xl border border-white/[.05] bg-white/[.018] p-3"><span className="text-zinc-300">Current-day:</span> GBP/USD is <span className={dayBias === "BULLISH" ? "text-emerald-300" : dayBias === "BEARISH" ? "text-red-300" : "text-amber-300"}>{dayBias.toLowerCase()}</span>.</div>
            <div className="rounded-xl border border-white/[.05] bg-white/[.018] p-3"><span className="text-zinc-300">Immediate:</span> DXY is <span className={dxy === "BEARISH" ? "text-red-300" : dxy === "BULLISH" ? "text-emerald-300" : "text-amber-300"}>{dxy.toLowerCase()}</span> while GBP/USD is <span className={gbpusd === "BULLISH" ? "text-emerald-300" : gbpusd === "BEARISH" ? "text-red-300" : "text-amber-300"}>{gbpusd.toLowerCase()}</span>.</div>
            <div className="rounded-xl border border-white/[.05] bg-white/[.018] p-3"><span className="text-zinc-300">Risk:</span> {risk.reason}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
