import { useEffect, useMemo, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import MarketWorkspace from "../components/MarketWorkspace";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };
type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" | "WARMING UP";

const WORKSPACE_KEY = "pal-market-workspace-visible";
const ASSETS = [
  ["DXY", "DXY"],
  ["GBP/USD", "GBPUSD"],
  ["Gold", "XAUUSD"],
  ["US500", "US500"],
  ["WTI", "USOIL"],
  ["US10Y", "US10Y"],
] as const;

function normalizeBias(value: unknown): Bias {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("BULL")) return "BULLISH";
  if (raw.includes("BEAR")) return "BEARISH";
  if (raw.includes("WARM")) return "WARMING UP";
  if (raw === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function biasClass(value: Bias) {
  if (value === "BULLISH") return "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-300";
  if (value === "BEARISH") return "border-red-300/20 bg-red-300/[.06] text-red-300";
  if (value === "WARMING UP") return "border-cyan-300/20 bg-cyan-300/[.05] text-cyan-300";
  if (value === "NEUTRAL") return "border-amber-300/20 bg-amber-300/[.05] text-amber-300";
  return "border-white/[.08] bg-white/[.02] text-zinc-500";
}

function fmt(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
}

function pct(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "—";
}

function marketClosed(date: Date) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  return day === 6 || (day === 0 && hour < 21) || (day === 5 && hour >= 21);
}

function sessionOpen(date: Date, start: number, end: number) {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function nextSessionChange(date: Date, start: number, end: number, open: boolean) {
  const nowHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const target = open ? end : start;
  let delta = target - nowHour;
  if (delta <= 0) delta += 24;
  return Math.max(0, Math.floor(delta * 3600));
}

function clock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FinalDashboard({ onPageChange }: Props) {
  const { data, isLoading, error } = usePAL();
  const [now, setNow] = useState(() => new Date());
  const [workspace, setWorkspace] = useState(() => window.localStorage.getItem(WORKSPACE_KEY) !== "0");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_KEY, workspace ? "1" : "0");
  }, [workspace]);

  if (isLoading) return <div className="min-h-screen bg-[#050607] p-10 text-white">Loading PAL command center…</div>;
  if (error || !data?.report) return <div className="min-h-screen bg-[#050607] flex items-center justify-center p-8 text-white"><div className="rounded-3xl border border-red-300/15 bg-red-300/[.04] p-8 text-center"><div className="text-[9px] uppercase tracking-[.2em] text-red-300">PAL feed unavailable</div><div className="mt-2 text-xl font-semibold">Unable to load the dashboard</div><button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl border border-white/[.08] px-4 py-2 text-xs">Retry</button></div></div>;

  const report: any = data.report;
  const today = report?.today?.today ?? {};
  const markets = report?.markets ?? report?.macro?.markets ?? report?.market_data ?? {};
  const rightNow = today?.right_now ?? {};
  const events: any[] = Array.isArray(report?.upcoming_events) ? report.upcoming_events : Array.isArray(report?.events) ? report.events : [];
  const closed = marketClosed(now);
  const dayBias = normalizeBias(today?.gbpusd?.bias ?? today?.bias);
  const dxyBias = normalizeBias(rightNow?.dxy?.bias);
  const gbpBias = normalizeBias(rightNow?.gbp?.bias);
  const pairBias = normalizeBias(rightNow?.gbpusd?.bias);
  const sync = dxyBias === "BEARISH" && pairBias === "BULLISH" || dxyBias === "BULLISH" && pairBias === "BEARISH";
  const confidence = Number(today?.confidence ?? 0);
  const highEvents = events.filter((e) => String(e?.impact ?? "").toLowerCase() === "high").length;
  const risk = closed ? "MARKET CLOSED" : highEvents >= 2 ? "HIGH" : highEvents === 1 ? "MEDIUM" : "LOW";
  const activeSessions = [
    ["Sydney", 21, 6],
    ["Asia", 0, 9],
    ["London", 7, 16],
    ["New York", 13, 22],
  ].map(([name, start, end]) => ({ name: String(name), open: sessionOpen(now, Number(start), Number(end)), countdown: clock(nextSessionChange(now, Number(start), Number(end), sessionOpen(now, Number(start), Number(end)))) }));
  const evidence = today?.components ?? {};
  const liveCount = ASSETS.filter(([, key]) => String(markets?.[key]?.status ?? "").toUpperCase() === "CURRENT").length;

  const marketCards = useMemo(() => ASSETS.map(([label, key]) => ({
    label,
    key,
    quote: markets?.[key] ?? {},
  })), [markets]);

  return (
    <div className="min-h-screen bg-[#050607] text-zinc-100">
      <div className="flex min-h-screen">
        <Sidebar symbol="GBPUSD" activePage="dashboard" onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {closed ? (
            <div className="border-b border-amber-300/10 bg-amber-300/[.045] px-5 py-2.5 text-center text-[9px] font-bold uppercase tracking-[.17em] text-amber-300">FX MARKET CLOSED · PAL will resume live intraday updates automatically when the market opens.</div>
          ) : (
            <div className="border-b border-emerald-300/10 bg-emerald-300/[.025] px-5 py-2.5 text-center text-[9px] font-bold uppercase tracking-[.17em] text-emerald-300/80"><span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />FX MARKET OPEN · LIVE DATA</div>
          )}

          <div className="mx-auto max-w-[1540px] p-5 lg:p-8">
            <section className="overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,.10),_transparent_31%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,.07),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,.028),rgba(255,255,255,.010))] p-5 lg:p-7 shadow-[0_35px_120px_-80px_rgba(34,211,238,.6)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /><span className="text-[9px] font-bold uppercase tracking-[.25em] text-cyan-300">PAL COMMAND CENTER</span></div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Market environment at a glance</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">Today’s context, immediate market state, sessions, event risk and provider health in one screen.</p></div><div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 font-mono text-sm text-zinc-300">{now.toLocaleTimeString([], { hour12: false })}</div></div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Today's GBP/USD bias</div><div className={`mt-3 inline-flex rounded-lg border px-2.5 py-1.5 text-[9px] font-bold ${biasClass(dayBias)}`}>{dayBias}</div><div className="mt-2 text-[9px] text-zinc-600">{confidence}% confidence · {Number(today?.evidence_count ?? 0)} evidence</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Right now</div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${biasClass(dxyBias)}`}>DXY {dxyBias}</span><span className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${biasClass(pairBias)}`}>GBP/USD {pairBias}</span></div><div className="mt-2 text-[9px] text-zinc-600">DXY {pct(rightNow?.dxy?.momentum, 3)} · GBP/USD {pct(rightNow?.gbpusd?.momentum, 3)}</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Market sync</div><div className={`mt-3 text-xl font-semibold ${closed ? "text-amber-300" : sync ? "text-emerald-300" : "text-amber-300"}`}>{closed ? "MARKET CLOSED" : sync ? "ALIGNED" : "MIXED"}</div><div className="mt-1 text-[9px] text-zinc-600">DXY ↔ GBP/USD</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Data health</div><div className="mt-3 text-xl font-semibold text-emerald-300">{closed ? "PAUSED" : `${liveCount}/6 LIVE`}</div><div className="mt-1 text-[9px] text-zinc-600">Provider observations</div></div>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_.8fr_.8fr]">
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Session board</div><div className="mt-1 text-xs font-semibold text-white">Open / closed · countdown</div></div><span className="text-[8px] uppercase tracking-wider text-zinc-700">UTC</span></div><div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{activeSessions.map((session) => <div key={session.name} className={`rounded-xl border p-3 ${session.open ? "border-emerald-300/15 bg-emerald-300/[.04]" : "border-white/[.05] bg-white/[.015]"}`}><div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-zinc-300">{session.name}</span><span className={`text-[7px] font-bold uppercase ${session.open ? "text-emerald-300" : "text-zinc-700"}`}>{session.open ? "OPEN" : "CLOSED"}</span></div><div className="mt-3 font-mono text-xs text-white">{session.countdown}</div><div className="mt-1 text-[7px] uppercase tracking-wider text-zinc-700">{session.open ? "until close" : "until open"}</div></div>)}</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Event radar</div><div className={`mt-3 text-xl font-semibold ${highEvents ? "text-red-300" : "text-emerald-300"}`}>{closed ? "CLOSED" : highEvents ? `${highEvents} HIGH` : "CLEAR"}</div><div className="mt-1 text-[9px] text-zinc-600">{events[0]?.title ?? events[0]?.event ?? "No high-impact event in current feed."}</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Risk pulse</div><div className={`mt-3 text-xl font-semibold ${risk === "HIGH" ? "text-red-300" : risk === "MEDIUM" ? "text-amber-300" : risk === "MARKET CLOSED" ? "text-amber-300" : "text-emerald-300"}`}>{risk}</div><div className="mt-1 text-[9px] text-zinc-600">General market conditions</div></div>
              </div>
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/[.07] bg-white/[.018] p-5 lg:p-6"><div className="flex items-center justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">Current-day context</div><h2 className="mt-2 text-xl font-semibold text-white">TODAY'S GBP/USD BIAS</h2></div><span className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${biasClass(dayBias)}`}>{dayBias}</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }} /></div><div className="mt-2 text-[9px] text-zinc-600">{confidence}% confidence</div><div className="mt-5 grid grid-cols-2 gap-2">{[["GBP news", evidence.gbp_news], ["USD news", evidence.usd_news], ["GBP data", evidence.gbp_data], ["USD data", evidence.usd_data], ["GBP/USD market", evidence.gbpusd_market], ["DXY market", evidence.dxy_market]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="text-[8px] uppercase tracking-wider text-zinc-700">{label}</div><div className="mt-1 font-mono text-sm text-zinc-300">{Number(value ?? 0) >= 0 ? "+" : ""}{Number(value ?? 0).toFixed(2)}</div></div>)}</div></div>

              <div className="rounded-3xl border border-emerald-300/10 bg-emerald-300/[.015] p-5 lg:p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /><span className="text-[9px] font-bold uppercase tracking-[.22em] text-emerald-300">RIGHT NOW</span></div><h2 className="mt-2 text-xl font-semibold text-white">Immediate market state</h2></div><span className="text-[8px] uppercase tracking-wider text-zinc-700">No timeframe labels</span></div><div className="mt-4 grid gap-3 md:grid-cols-3">{[["DXY", dxyBias, rightNow?.dxy], ["GBP", gbpBias, rightNow?.gbp], ["GBP/USD", pairBias, rightNow?.gbpusd]].map(([label, biasValue, state]: any) => <div key={String(label)} className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.18em] text-zinc-500">{label}</span><span className={`rounded-lg border px-2 py-1 text-[8px] font-bold ${biasClass(biasValue)}`}>{biasValue}</span></div><div className="mt-5 text-sm font-bold text-zinc-300">{biasValue === "BULLISH" ? "↑ BUYING" : biasValue === "BEARISH" ? "↓ SELLING" : biasValue === "WARMING UP" ? "• COLLECTING" : "→ FLAT"}</div><div className="mt-2 font-mono text-[9px] text-zinc-600">Momentum {pct(state?.momentum, 3)}</div></div>)}</div></div>
            </section>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.018] px-4 py-3"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">Live Market Workspace</div><div className="mt-1 text-[10px] text-zinc-600">Optional terminal for six provider-backed markets.</div></div><button type="button" onClick={() => setWorkspace((value) => !value)} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:border-cyan-300/20 hover:text-cyan-300">{workspace ? "Hide Workspace" : "Show Workspace"}</button></div>
            {workspace ? <MarketWorkspace markets={markets} report={report} onHide={() => setWorkspace(false)} /> : null}

            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Journal</div><div className="mt-3 text-xl font-semibold text-white">MT5-linked</div><button onClick={() => onPageChange("journal")} className="mt-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Open Journal →</button></div><div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Macro Desk</div><div className="mt-3 text-xl font-semibold text-white">Live context</div><button onClick={() => onPageChange("macro-desk")} className="mt-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Open Macro Desk →</button></div><div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Macro Calendar</div><div className="mt-3 text-xl font-semibold text-white">Events</div><button onClick={() => onPageChange("macro-calendar")} className="mt-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Open Calendar →</button></div><div className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-600">Daily Reports</div><div className="mt-3 text-xl font-semibold text-white">Review</div><button onClick={() => onPageChange("reports")} className="mt-3 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Open Reports →</button></div></section>
          </div>
        </main>
      </div>
    </div>
  );
}
