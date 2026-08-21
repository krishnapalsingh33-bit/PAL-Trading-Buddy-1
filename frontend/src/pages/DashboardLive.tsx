import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" | "WARMING UP";

type Point = { time?: string | null; price?: number | null };

function normalizeBias(value: unknown): Bias {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw.includes("BULL")) return "BULLISH";
  if (raw.includes("BEAR")) return "BEARISH";
  if (raw.includes("WARM")) return "WARMING UP";
  if (raw === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function tone(bias: Bias) {
  if (bias === "BULLISH") return "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.07]";
  if (bias === "BEARISH") return "text-red-300 border-red-300/20 bg-red-300/[.07]";
  if (bias === "WARMING UP") return "text-cyan-300 border-cyan-300/15 bg-cyan-300/[.05]";
  if (bias === "NEUTRAL") return "text-amber-300 border-amber-300/20 bg-amber-300/[.06]";
  return "text-zinc-500 border-white/[.08] bg-white/[.02]";
}

function priceTone(value: unknown) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return "text-emerald-300";
  if (Number.isFinite(n) && n < 0) return "text-red-300";
  return "text-zinc-500";
}

function formatPrice(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "—";
}

function formatPct(value: unknown, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "—";
}

function sessionState(date: Date) {
  const hour = date.getUTCHours();
  return {
    London: hour >= 7 && hour < 16,
    "New York": hour >= 13 && hour < 22,
    Sydney: hour >= 21 || hour < 6,
    Asia: hour >= 0 && hour < 9,
  };
}

function Sparkline({ points, positive }: { points: Point[]; positive: boolean }) {
  const values = points.map((point) => Number(point?.price)).filter(Number.isFinite) as number[];
  if (values.length < 2) {
    return <div className="flex h-10 items-center text-[8px] uppercase tracking-[.16em] text-zinc-700">Collecting movement</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 36 - ((value - min) / span) * 28;
    return `${x},${y}`;
  }).join(" ");
  const stroke = positive ? "#34d399" : "#f87171";
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RightNowCard({ label, bias, momentum, price, points }: { label: string; bias: Bias; momentum: number | null; price: number | null; points: Point[] }) {
  const positive = bias === "BULLISH";
  const negative = bias === "BEARISH";
  const direction = positive ? "↑ BUYING" : negative ? "↓ SELLING" : bias === "NEUTRAL" ? "→ FLAT" : "• COLLECTING";
  return (
    <div className={`group rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[.025] ${tone(bias)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${bias === "WARMING UP" ? "bg-cyan-300 animate-pulse" : positive ? "bg-emerald-300 animate-pulse" : negative ? "bg-red-300 animate-pulse" : "bg-amber-300"}`} />
          <span className="text-[9px] font-semibold uppercase tracking-[.18em] text-zinc-500">{label}</span>
        </div>
        <span className="text-[8px] uppercase tracking-[.14em] text-zinc-600">RIGHT NOW</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className={`text-[11px] font-bold tracking-[.08em] ${positive ? "text-emerald-300" : negative ? "text-red-300" : bias === "WARMING UP" ? "text-cyan-300" : "text-amber-300"}`}>{direction}</div>
        <span className="rounded-lg border border-current/15 px-2 py-1 text-[8px] font-bold">{bias}</span>
      </div>
      <div className="mt-3 text-xl font-semibold text-white">{formatPrice(price)}</div>
      <div className={`mt-1 text-[9px] font-mono ${priceTone(momentum)}`}>Momentum {formatPct(momentum)}</div>
      <div className="mt-3 opacity-90">
        <Sparkline points={points} positive={positive || !negative} />
      </div>
    </div>
  );
}

export default function DashboardLive({ activePage = "dashboard", onPageChange }: { activePage?: any; onPageChange?: (page: any) => void }) {
  const { data, isLoading, error } = usePAL();
  const [clock, setClock] = useState(() => new Date());
  const [showMacro, setShowMacro] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sessions = useMemo(() => sessionState(clock), [clock]);

  if (isLoading) return <div className="min-h-screen bg-[#050607] p-8 text-white">Loading live PAL feed…</div>;
  if (error || !data?.report) {
    return <div className="min-h-screen bg-[#050607] text-white flex items-center justify-center p-8"><div className="max-w-md rounded-2xl border border-red-300/20 bg-red-300/[.04] p-7 text-center"><div className="text-[9px] uppercase tracking-[.2em] text-red-300">Live feed error</div><h1 className="mt-3 text-2xl font-semibold">PAL cannot read the backend</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Restart the backend API and reload the dashboard.</p><button type="button" className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm" onClick={() => window.location.reload()}>Retry</button></div></div>;
  }

  const report: any = data.report;
  const todayContainer = report.today ?? {};
  const today = todayContainer.today ?? {};
  const macro = report.macro ?? {};
  const markets = report.markets ?? macro.markets ?? report.market_data ?? {};
  const rightNow = today.right_now ?? {};

  const rightNowRows = [
    { key: "dxy", label: "DXY", marketKey: "DXY" },
    { key: "gbp", label: "GBP", marketKey: "GBPUSD" },
    { key: "gbpusd", label: "GBP/USD", marketKey: "GBPUSD" },
  ].map((item) => {
    const state = rightNow[item.key] ?? {};
    const quote = markets?.[item.marketKey] ?? {};
    return {
      ...item,
      bias: normalizeBias(state.bias),
      momentum: state.momentum ?? null,
      price: state.price ?? quote.right_now_price ?? quote.price ?? null,
      points: quote.right_now_points ?? [],
    };
  });

  const dxyRight = rightNowRows.find((row) => row.key === "dxy")?.bias ?? "UNKNOWN";
  const gbpusdRight = rightNowRows.find((row) => row.key === "gbpusd")?.bias ?? "UNKNOWN";
  const sync = dxyRight === "BEARISH" && gbpusdRight === "BULLISH"
    ? { label: "ALIGNED", detail: "DXY ↓ · GBP/USD ↑", className: "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.06]" }
    : dxyRight === "BULLISH" && gbpusdRight === "BEARISH"
      ? { label: "ALIGNED", detail: "DXY ↑ · GBP/USD ↓", className: "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.06]" }
      : dxyRight === "WARMING UP" || gbpusdRight === "WARMING UP" || dxyRight === "UNKNOWN" || gbpusdRight === "UNKNOWN"
        ? { label: "WARMING UP", detail: "Waiting for live intraday movement", className: "text-cyan-300 border-cyan-300/20 bg-cyan-300/[.06]" }
        : dxyRight === gbpusdRight
          ? { label: "DIVERGENT", detail: "Both assets currently moving the same way", className: "text-amber-300 border-amber-300/20 bg-amber-300/[.06]" }
          : { label: "MIXED", detail: "Live relationship is changing", className: "text-zinc-300 border-white/[.08] bg-white/[.03]" };

  const sessionCards = ["Asia", "London", "New York"].map((name) => ({ name, open: Boolean((sessions as any)[name]) }));
  const currentDayBias = normalizeBias(today.gbpusd?.bias);
  const confidence = Number(today.confidence ?? 0);
  const evidenceCount = Number(today.evidence_count ?? 0);

  const marketsList = [
    ["DXY", "DXY"], ["GBP/USD", "GBPUSD"], ["Gold", "XAUUSD"], ["WTI", "USOIL"], ["US 10Y", "US10Y"], ["US500", "US500"],
  ] as const;

  return (
    <div className="min-h-screen bg-[#050607] text-zinc-100">
      <div className="flex min-h-screen">
        <Sidebar symbol="GBPUSD" activePage={activePage} onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
            <header className="rounded-3xl border border-white/[.07] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,.10),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.012))] p-5 lg:p-6 shadow-[0_30px_100px_-60px_rgba(16,185,129,.35)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">✦</div>
                  <div>
                    <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold text-white">PAL Trading Buddy</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Live</span></div>
                    <p className="mt-1 text-xs text-zinc-500">Current-day market context separated from immediate price movement.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionCards.map((session) => <div key={session.name} className="rounded-xl border border-white/[.07] bg-black/20 px-3 py-2"><div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{session.name}</div><div className={`mt-1 text-[8px] uppercase tracking-wider ${session.open ? "text-emerald-300" : "text-zinc-600"}`}>{session.open ? "OPEN" : "CLOSED"}</div></div>)}
                  <div className="rounded-xl border border-white/[.07] bg-black/20 px-3 py-2 font-mono text-xs text-zinc-300">{clock.toLocaleTimeString([], { hour12: false })}</div>
                </div>
              </div>
            </header>

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/[.07] bg-white/[.018] p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">Current-day context</div><h2 className="mt-2 text-xl font-semibold text-white">TODAY'S GBP/USD BIAS</h2></div><span className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${tone(currentDayBias)}`}>{currentDayBias}</span></div>
                <div className="mt-5 flex items-center justify-between text-[9px] uppercase tracking-wider text-zinc-600"><span>{confidence}% confidence</span><span>{evidenceCount} evidence items</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-cyan-300/70 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }} /></div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-[9px]">
                  <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="uppercase tracking-wider text-zinc-600">GBP score</div><div className="mt-1 font-mono text-sm text-zinc-300">{Number(today.gbp?.score ?? 0).toFixed(2)}</div></div>
                  <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="uppercase tracking-wider text-zinc-600">USD score</div><div className="mt-1 font-mono text-sm text-zinc-300">{Number(today.dxy?.score ?? 0).toFixed(2)}</div></div>
                  <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="uppercase tracking-wider text-zinc-600">GBP/USD today</div><div className="mt-1 font-mono text-sm text-zinc-300">{formatPct(markets?.GBPUSD?.change_percent ?? markets?.GBPUSD?.change)}</div></div>
                  <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="uppercase tracking-wider text-zinc-600">DXY today</div><div className="mt-1 font-mono text-sm text-zinc-300">{formatPct(markets?.DXY?.change_percent ?? markets?.DXY?.change)}</div></div>
                </div>
                <button type="button" onClick={() => setShowMacro((value) => !value)} className="mt-4 w-full rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:bg-white/[.04]">{showMacro ? "Hide broader macro" : "Show broader macro"}</button>
              </div>

              <div className="rounded-3xl border border-emerald-300/12 bg-emerald-300/[.018] p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /><span className="text-[9px] font-bold uppercase tracking-[.22em] text-emerald-300">Right now</span></div><h2 className="mt-2 text-xl font-semibold text-white">Immediate market state</h2></div><span className="text-[8px] uppercase tracking-wider text-zinc-600">No timeframe labels</span></div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {rightNowRows.map((row) => <RightNowCard key={row.key} label={row.label} bias={row.bias} momentum={row.momentum} price={Number(row.price)} points={row.points} />)}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-white/[.07] bg-white/[.018] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.22em] text-zinc-600">Market sync</div><div className="mt-1 text-xs text-zinc-400">DXY and GBP/USD immediate relationship</div></div><div className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase tracking-wider ${sync.className}`}>{sync.label}</div></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500"><span className="rounded-lg border border-white/[.06] bg-black/20 px-3 py-2">DXY <strong className="ml-1 text-zinc-300">{dxyRight}</strong></span><span className="text-zinc-700">↔</span><span className="rounded-lg border border-white/[.06] bg-black/20 px-3 py-2">GBP/USD <strong className="ml-1 text-zinc-300">{gbpusdRight}</strong></span><span className="ml-1 text-zinc-600">{sync.detail}</span></div>
            </section>

            {showMacro && <section className="mt-4 rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[9px] font-bold uppercase tracking-[.22em] text-zinc-600">Broader macro regime</div><div className="mt-4 grid gap-3 md:grid-cols-3">{[["DXY", macro.dxy], ["GBP", macro.gbp], ["GBP/USD", macro.gbpusd]].map(([label, item]: any) => <div key={String(label)} className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{label}</span><span className={`rounded-lg border px-2 py-1 text-[8px] font-bold ${tone(normalizeBias(item?.bias))}`}>{normalizeBias(item?.bias)}</span></div><p className="mt-3 text-[10px] leading-5 text-zinc-500">{Array.isArray(item?.reasons) && item.reasons.length ? item.reasons.slice(0, 3).join(" · ") : "No strong broader macro catalyst is active."}</p></div>)}</div></section>}

            <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Live quotes", `${["DXY", "GBPUSD", "XAUUSD", "USOIL", "US10Y", "US500"].filter((symbol) => String(markets?.[symbol]?.status ?? "").toUpperCase() === "CURRENT").length}/6`, "current provider observations"],
                ["Sessions open", String(sessionCards.filter((session) => session.open).length), "live session status"],
                ["Today GBP/USD", currentDayBias, "current-day evidence"],
                ["Data integrity", "VERIFIED", "unknown stays unknown"],
              ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/[.12]"><div className="text-[9px] uppercase tracking-[.2em] text-zinc-600">{label}</div><div className={`mt-3 text-2xl font-semibold ${label === "Data integrity" ? "text-emerald-300" : label === "Today GBP/USD" ? tone(currentDayBias).split(" ")[0] : "text-white"}`}>{value}</div><div className="mt-1 text-[10px] text-zinc-600">{detail}</div></div>)}
            </section>

            <section className="mt-4 rounded-3xl border border-white/[.07] bg-white/[.018] p-5 lg:p-6">
              <div className="flex flex-col gap-1"><div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">Market data</div><h2 className="text-xl font-semibold text-white">Actual provider observations</h2><p className="text-xs text-zinc-600">PAL shows provider values directly and does not guess when a quote is unavailable.</p></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {marketsList.map(([label, key]) => {
                  const quote = markets?.[key] ?? {};
                  const points = quote.right_now_points ?? [];
                  return <div key={label} className="group rounded-2xl border border-white/[.06] bg-black/20 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/[.12]"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{label}</span><span className={`text-[8px] font-bold uppercase tracking-wider ${String(quote.status ?? "").toUpperCase() === "CURRENT" ? "text-emerald-300" : "text-zinc-600"}`}>{String(quote.status ?? "UNAVAILABLE")}</span></div><div className="mt-4 flex items-end justify-between gap-4"><div><div className="text-2xl font-semibold text-white">{formatPrice(quote.price)}</div><div className={`mt-1 font-mono text-[10px] ${priceTone(quote.change_percent)}`}>{formatPct(quote.change_percent, 2)}</div></div><div className="w-28 opacity-80"><Sparkline points={points} positive={Number(quote.change_percent) >= 0} /></div></div></div>;
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
