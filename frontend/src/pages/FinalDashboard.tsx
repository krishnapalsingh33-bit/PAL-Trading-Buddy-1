import { useEffect, useMemo, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };
type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

const SOURCES: Record<string, string> = {
  "Google News": "https://news.google.com/",
  GDELT: "https://www.gdeltproject.org/",
  "Forex Factory": "https://www.forexfactory.com/calendar",
  Apify: "https://apify.com/",
  BLS: "https://www.bls.gov/schedule/news_release/",
  "Federal Reserve": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  Treasury: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  FRED: "https://fred.stlouisfed.org/",
  "UK Office for National Statistics": "https://www.ons.gov.uk/releasecalendar",
  "Yahoo Finance": "https://finance.yahoo.com/",
};

function bias(value: unknown): Bias {
  const s = String(value ?? "").toUpperCase();
  if (s.includes("BULL")) return "BULLISH";
  if (s.includes("BEAR")) return "BEARISH";
  return "NEUTRAL";
}

function biasClasses(value: Bias) {
  if (value === "BULLISH") return "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-300";
  if (value === "BEARISH") return "border-red-300/20 bg-red-300/[.06] text-red-300";
  return "border-amber-300/20 bg-amber-300/[.06] text-amber-300";
}

function fmtTime(value: unknown) {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(value: unknown) {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function num(value: unknown, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

function percent(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
}

function sourceUrl(item: any) {
  return item?.source_url || item?.url || SOURCES[item?.source] || SOURCES[item?.provider];
}

function isWeekend(date: Date) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(date);
  return day === "Sat" || day === "Sun";
}

function sessionName(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(date));
  if (hour >= 17) return "New York";
  if (hour >= 11) return "London";
  return "Market";
}

function confidenceStrength(value: number) {
  if (value >= 75) return "STRONG";
  if (value >= 55) return "MODERATE";
  if (value >= 35) return "WEAK";
  return "LOW EVIDENCE";
}

function Progress({ value }: { value: number }) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-cyan-300 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function BiasCard({ title, value, confidence, reasons }: { title: string; value: Bias; confidence: number; reasons: string[] }) {
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0;
  return (
    <article className="rounded-2xl border border-white/[.07] bg-[#09151a] p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,.95)]">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-600">{title}</div>
        <div className="text-3xl font-semibold tabular-nums text-white">{safeConfidence}%</div>
      </div>
      <div className="mt-3 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${value === "BULLISH" ? "bg-emerald-300" : value === "BEARISH" ? "bg-red-300" : "bg-amber-300"}`} /><span className={`text-2xl font-black tracking-tight ${value === "BULLISH" ? "text-emerald-300" : value === "BEARISH" ? "text-red-300" : "text-amber-300"}`}>{value}</span></div>
      <div className="mt-2 text-[9px] uppercase tracking-[.18em] text-zinc-700">Confidence · {confidenceStrength(safeConfidence)}</div>
      <Progress value={safeConfidence} />
      {reasons.length > 0 && <div className="mt-4 space-y-2">{reasons.slice(0, 3).map((reason, index) => <div key={index} className="flex gap-2 text-[10px] leading-4 text-zinc-400"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" /><span>{reason}</span></div>)}</div>}
    </article>
  );
}

export default function FinalDashboard({ onPageChange }: Props) {
  const { data, isLoading, error } = usePAL();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (isLoading) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-zinc-400">Loading PAL Market Intelligence…</div>;
  if (error || !data?.report) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-red-300 text-center p-8"><div><div className="text-lg font-semibold">PAL data feed unavailable</div><div className="mt-2 text-xs text-zinc-500">Make sure the backend is running on 127.0.0.1:8000, then refresh.</div></div></div>;

  const report: any = data.report;
  const macro: any = report.macro ?? {};
  const news: any = report.news ?? {};
  const markets: any = report.markets ?? news.markets ?? {};
  const macroBias: any = news.macro_bias ?? {};
  const evidence: any = macroBias.evidence ?? {};
  const dxyValue = bias(macro.dxy?.bias ?? macroBias.dxy?.bias);
  const pairValue = bias(macro.gbpusd?.bias ?? macroBias.gbpusd?.bias);
  const dxyConfidence = Number(macro.dxy?.confidence ?? macroBias.dxy?.confidence ?? 0);
  const pairConfidence = Number(macro.gbpusd?.confidence ?? macroBias.gbpusd?.confidence ?? 0);
  const upcoming = Array.isArray(news.upcoming_events) ? news.upcoming_events : [];
  const recent = Array.isArray(news.recent_events) ? news.recent_events : [];
  const headlines = Array.isArray(news.headlines) ? news.headlines : [];
  const highImpact = upcoming.filter((item: any) => String(item?.impact ?? "").toUpperCase().includes("HIGH"));
  const freshHeadlines = headlines.slice(0, 6);
  const visibleEvents = upcoming.slice(0, 8);
  const relationship = dxyValue === "BULLISH" && pairValue === "BEARISH" ? "USD FAVOURED" : dxyValue === "BEARISH" && pairValue === "BULLISH" ? "GBP FAVOURED" : "MIXED";
  const closed = isWeekend(now);
  const condition = closed ? "MARKET CLOSED" : highImpact.length > 0 ? "EVENT-DRIVEN" : pairConfidence >= 60 ? "DIRECTIONAL" : "MIXED / WATCH";
  const finalVerdict = pairValue === "BULLISH" ? "GBP/USD upside bias" : pairValue === "BEARISH" ? "GBP/USD downside bias" : "No strong GBP/USD direction";
  const finalReasons = Array.isArray(macro.gbpusd?.reasons) ? macro.gbpusd.reasons : Array.isArray(macroBias.gbpusd?.reasons) ? macroBias.gbpusd.reasons : [];
  const dxyReasons = Array.isArray(macro.dxy?.reasons) ? macro.dxy.reasons : Array.isArray(macroBias.dxy?.reasons) ? macroBias.dxy.reasons : [];
  const sourceNames = Array.from(new Set([...(Array.isArray(news.calendar_sources) ? news.calendar_sources : []), ...(Array.isArray(evidence.sources) ? evidence.sources : [])]));

  const marketCards = useMemo(() => [
    ["DXY", "DXY", "Dollar Index"],
    ["GBP/USD", "GBPUSD", "Cable"],
    ["US 10Y", "US10Y", "U.S. Treasury yield"],
    ["Gold", "XAUUSD", "Spot gold"],
  ] as const, []);

  return (
    <div className="min-h-screen bg-[#05080b] text-white">
      <div className="flex min-h-screen">
        <Sidebar symbol="GBPUSD" activePage="dashboard" onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className={`border-b px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.24em] ${closed ? "border-amber-300/10 bg-amber-300/[.04] text-amber-300" : "border-cyan-300/10 bg-cyan-300/[.02] text-cyan-300"}`}>{closed ? "FX MARKET CLOSED · WEEKEND" : "● LIVE MULTI-SOURCE MARKET INTELLIGENCE"}</div>

          <div className="mx-auto max-w-[1380px] p-5 lg:p-7">
            <header className="rounded-[28px] border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.07),transparent_35%),#081219] p-6 shadow-[0_30px_100px_-65px_rgba(34,211,238,.45)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">PAL · MARKET INTELLIGENCE</div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">{sessionName(now)} Session Dashboard</h1>
                  <div className="mt-1 text-xs text-zinc-500">{fmtDate(now)} · Evidence-backed macro, news & economic events</div>
                </div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 text-right"><div className="font-mono text-lg tabular-nums">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">LIVE IST</div></div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/[.06] bg-black/20 p-4">
                <div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-700">SESSION REGIME</div>
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-semibold">{macro.headline || (highImpact.length ? "Major macro catalysts are on the radar." : "Recent USD and GBP macro developments are being monitored.")}</h2><div className="mt-1 text-[10px] text-zinc-500">{macro.summary || "PAL is evaluating released data, fresh headlines and scheduled catalysts."}</div></div><span className="w-fit rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[9px] font-black text-amber-300">{condition}</span></div>
              </div>
            </header>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <BiasCard title="DXY" value={dxyValue} confidence={dxyConfidence} reasons={dxyReasons} />
              <BiasCard title="GBP / USD" value={pairValue} confidence={pairConfidence} reasons={finalReasons} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Relationship</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{relationship}</div><div className="mt-1 text-[9px] text-zinc-600">DXY ↔ GBP/USD macro relationship</div></article>
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Upcoming</div><div className="mt-2 text-2xl font-semibold text-amber-300">{upcoming.length || 0}</div><div className="mt-1 text-[9px] text-zinc-600">scheduled USD/GBP catalysts</div></article>
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Fresh news</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{headlines.length || 0}</div><div className="mt-1 text-[9px] text-zinc-600">recent macro headlines collected</div></article>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden">
                <div className="border-b border-white/[.06] px-5 py-4 flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">Major events · IST</div><h2 className="mt-1 text-lg font-semibold">Economic radar</h2></div><span className="text-[8px] text-zinc-700">USD · GBP</span></div>
                {visibleEvents.length ? <div className="divide-y divide-white/[.05]">{visibleEvents.map((event: any, index: number) => <div key={event.id ?? index} className="grid gap-3 px-5 py-4 md:grid-cols-[95px_minmax(0,1fr)_105px]"><div><div className="text-[8px] uppercase text-zinc-700">{fmtDate(event.time)}</div><div className="mt-1 font-mono text-sm font-semibold text-cyan-300">{fmtTime(event.time)}</div></div><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-zinc-200">{event.title}</span><span className={`rounded-md border px-2 py-1 text-[8px] font-bold ${String(event.impact ?? "").toUpperCase().includes("HIGH") ? "border-red-300/20 bg-red-300/[.05] text-red-300" : String(event.impact ?? "").toUpperCase().includes("MEDIUM") ? "border-amber-300/20 bg-amber-300/[.05] text-amber-300" : "border-white/[.07] text-zinc-600"}`}>{event.impact ?? "—"}</span><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-600">{event.currency ?? "—"}</span></div>{(event.actual ?? event.forecast ?? event.previous) && <div className="mt-2 grid grid-cols-3 gap-2 text-[8px] text-zinc-700"><span>Actual <b className="text-zinc-400">{event.actual ?? "—"}</b></span><span>Forecast <b className="text-zinc-400">{event.forecast ?? "—"}</b></span><span>Previous <b className="text-zinc-400">{event.previous ?? "—"}</b></span></div>}</div><div className="flex items-center justify-end">{sourceUrl(event) ? <a href={sourceUrl(event)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Verify ↗</a> : <span className="text-[8px] text-zinc-700">Provider feed</span>}</div></div>)}</div> : <div className="p-8 text-center text-xs text-zinc-700">No major scheduled events returned.</div>}
              </article>

              <article className="rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden">
                <div className="border-b border-white/[.06] px-5 py-4"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">News intelligence</div><h2 className="mt-1 text-lg font-semibold">Latest macro headlines</h2></div>
                {freshHeadlines.length ? <div className="divide-y divide-white/[.05]">{freshHeadlines.map((item: any, index: number) => <div key={item.id ?? index} className="p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-500">{item.currency ?? "CROSS"}</span><span className="text-[8px] text-zinc-700">{fmtTime(item.published_at ?? item.published)}</span></div><div className="mt-2 text-[10px] leading-4 text-zinc-300">{item.title}</div><div className="mt-2 flex items-center justify-between"><span className="text-[8px] text-zinc-700">{item.source ?? item.provider ?? "News provider"}</span>{sourceUrl(item) && <a href={sourceUrl(item)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Source ↗</a>}</div></div>)}</div> : <div className="p-8 text-center text-xs text-zinc-700">No fresh macro headlines returned.</div>}
              </article>
            </section>

            {recent.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-emerald-300/70">Released data</div><h2 className="mt-1 text-lg font-semibold">What just moved the market</h2></div><span className="text-[8px] text-zinc-700">Actual vs forecast where available</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{recent.slice(0, 6).map((event: any, index: number) => <div key={event.id ?? index} className="rounded-xl border border-white/[.05] bg-black/20 p-4"><div className="text-[8px] text-zinc-700">{fmtTime(event.time)} · {event.currency ?? "—"}</div><div className="mt-2 text-[10px] font-semibold text-zinc-300">{event.title}</div><div className="mt-3 grid grid-cols-3 gap-2 text-[8px] text-zinc-700"><span>A <b className="text-zinc-400">{event.actual ?? "—"}</b></span><span>F <b className="text-zinc-400">{event.forecast ?? "—"}</b></span><span>P <b className="text-zinc-400">{event.previous ?? "—"}</b></span></div></div>)}</div></section>}

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-amber-300/70">Bias invalidation</div><div className="mt-3 space-y-2"><div className="rounded-xl border border-white/[.05] bg-black/20 p-3 text-[10px] text-zinc-500">USD bullishness weakens if U.S. data materially softens, yields fall sharply, or policy expectations turn more dovish.</div><div className="rounded-xl border border-white/[.05] bg-black/20 p-3 text-[10px] text-zinc-500">GBP/USD downside weakens if sterling receives a strong UK catalyst or USD evidence reverses.</div></div></article>
              <article className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">Market snapshot</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{marketCards.map(([label, key, sub]) => { const quote = markets[key] ?? {}; return <div key={key} className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="flex justify-between"><div><div className="text-[9px] font-semibold text-zinc-300">{label}</div><div className="text-[8px] text-zinc-700">{sub}</div></div><span className="text-[8px] text-zinc-700">{quote.status ?? "—"}</span></div><div className="mt-3 flex items-end justify-between"><span className="font-mono text-sm">{num(quote.price)}</span><span className="text-[9px] text-zinc-500">{percent(quote.change_percent)}</span></div></div>; })}</div></article>
            </section>

            {sourceNames.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">Source verification</div><div className="mt-3 flex flex-wrap gap-2">{sourceNames.map((name: string) => { const url = SOURCES[name] || SOURCES["Google News"]; return <a key={name} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/[.05] bg-black/20 px-3 py-2 text-[8px] text-zinc-500 hover:text-cyan-300">{name} ↗</a>; })}</div></section>}

            <section className="mt-4 rounded-[24px] border border-cyan-300/10 bg-[linear-gradient(120deg,rgba(34,211,238,.04),rgba(16,185,129,.025))] p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[8px] uppercase tracking-[.22em] text-cyan-300">FINAL MARKET VERDICT</div><h2 className="mt-2 text-2xl font-semibold">{finalVerdict}</h2><p className="mt-2 text-xs text-zinc-500">DXY {dxyValue} · GBP/USD {pairValue} · Relationship {relationship}</p><p className="mt-2 max-w-3xl text-[10px] leading-5 text-zinc-500">{finalReasons.length ? finalReasons[0] : "The current evidence does not support a strong directional conclusion."}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-lg border px-3 py-2 text-[9px] font-bold ${biasClasses(dxyValue)}`}>DXY {Math.round(dxyConfidence)}%</span><span className={`rounded-lg border px-3 py-2 text-[9px] font-bold ${biasClasses(pairValue)}`}>GBP/USD {Math.round(pairConfidence)}%</span><span className="rounded-lg border border-amber-300/20 bg-amber-300/[.05] px-3 py-2 text-[9px] font-bold text-amber-300">{condition}</span></div></div></section>

            <footer className="py-6 text-center text-[8px] uppercase tracking-[.18em] text-zinc-800">PAL · source-attributed market intelligence · no setup or execution logic</footer>
          </div>
        </main>
      </div>
    </div>
  );
}
