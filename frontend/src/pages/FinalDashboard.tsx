import { useEffect, useMemo, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };
type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";

const SOURCES: Record<string, string> = {
  "Google News": "https://news.google.com/",
  GDELT: "https://www.gdeltproject.org/",
  "Forex Factory": "https://www.forexfactory.com/calendar",
  Apify: "https://apify.com/",
  BLS: "https://www.bls.gov/schedule/news_release/",
  "Federal Reserve": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  "UK Office for National Statistics": "https://www.ons.gov.uk/releasecalendar",
  FRED: "https://fred.stlouisfed.org/",
  "Yahoo Finance": "https://finance.yahoo.com/",
};

function bias(value: unknown): Bias {
  const s = String(value ?? "").toUpperCase();
  if (s.includes("BULL")) return "BULLISH";
  if (s.includes("BEAR")) return "BEARISH";
  return "NEUTRAL";
}
function badge(b: Bias) {
  return b === "BULLISH" ? "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300" : b === "BEARISH" ? "border-red-300/20 bg-red-300/[.07] text-red-300" : "border-amber-300/20 bg-amber-300/[.06] text-amber-300";
}
function bar(v: number) {
  return <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-cyan-300 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>;
}
function timeIST(value: unknown) {
  const d = new Date(String(value ?? ""));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}
function dateIST(value: unknown) {
  const d = new Date(String(value ?? ""));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short" });
}
function sourceUrl(item: any) { return item?.source_url || item?.url || SOURCES[item?.source] || SOURCES[item?.provider]; }
function isWeekend(d: Date) { const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d); return day === "Sat" || day === "Sun"; }

function BiasCard({ label, value, confidence, reasons }: { label: string; value: unknown; confidence: number; reasons: string[] }) {
  const b = bias(value);
  return <article className="rounded-2xl border border-white/[.07] bg-[#0a171c] p-5">
    <div className="flex items-center justify-between"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-600">{label}</div><div className="text-3xl font-semibold tabular-nums">{Math.round(confidence)}%</div></div>
    <div className="mt-4 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${b === "BULLISH" ? "bg-emerald-300" : b === "BEARISH" ? "bg-red-300" : "bg-amber-300"}`} /><span className={`text-2xl font-black ${badge(b).split(" ").slice(-1)[0]}`}>{b}</span></div>
    <div className="mt-1 text-[8px] uppercase tracking-[.2em] text-zinc-700">fundamental evidence</div>
    {bar(confidence)}
    {reasons.length > 0 && <div className="mt-4 space-y-2">{reasons.slice(0, 3).map((x, i) => <div key={i} className="text-[10px] leading-4 text-zinc-400">• {x}</div>)}</div>}
  </article>;
}

export default function FinalDashboard({ onPageChange }: Props) {
  const { data, isLoading, error } = usePAL();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);

  if (isLoading) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-zinc-400">Loading PAL Market Intelligence…</div>;
  if (error || !data?.report) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-red-300">PAL data feed unavailable. Check the backend and refresh.</div>;

  const report: any = data.report;
  const macro: any = report.macro ?? {};
  const macroBias: any = report.news?.macro_bias ?? {};
  const headlines: any[] = Array.isArray(report.news?.headlines) ? report.news.headlines : [];
  const upcoming: any[] = Array.isArray(report.news?.upcoming_events) ? report.news.upcoming_events : [];
  const recent: any[] = Array.isArray(report.news?.recent_events) ? report.news.recent_events : [];
  const closed = isWeekend(now);
  const dxy = bias(macro.dxy?.bias ?? macroBias.dxy?.bias);
  const pair = bias(macro.gbpusd?.bias ?? macroBias.gbpusd?.bias);
  const dxyConf = Number(macro.dxy?.confidence ?? macroBias.dxy?.confidence ?? 0);
  const pairConf = Number(macro.gbpusd?.confidence ?? macroBias.gbpusd?.confidence ?? 0);
  const alignment = String(macroBias.alignment ?? "MIXED");
  const visibleEvents = useMemo(() => [...upcoming, ...recent].sort((a, b) => new Date(String(a.time ?? 0)).getTime() - new Date(String(b.time ?? 0)).getTime()).slice(0, 8), [upcoming, recent]);
  const highImpact = upcoming.filter((e: any) => String(e.impact ?? "").toUpperCase().includes("HIGH"));
  const regime = highImpact.length ? "EVENT-DRIVEN" : pair === "BULLISH" || pair === "BEARISH" ? "DIRECTIONAL" : "WATCH";
  const finalVerdict = pair === "BULLISH" && pairConf >= 55 ? "GBP/USD UPSIDE BIAS" : pair === "BEARISH" && pairConf >= 55 ? "GBP/USD DOWNSIDE BIAS" : "NO STRONG DIRECTION";
  const sourceNames = Array.from(new Set([...(Array.isArray(report.news?.calendar_sources) ? report.news.calendar_sources : []), ...(Array.isArray(macroBias.evidence?.sources) ? macroBias.evidence.sources : [])]));

  return <div className="min-h-screen bg-[#05080b] text-white">
    <div className="flex min-h-screen"><Sidebar symbol="GBPUSD" activePage="dashboard" onPageChange={onPageChange} /><main className="min-w-0 flex-1 overflow-y-auto">
      <div className={`border-b px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.25em] ${closed ? "border-amber-300/10 bg-amber-300/[.04] text-amber-300" : "border-cyan-300/10 bg-cyan-300/[.025] text-cyan-300"}`}>{closed ? "FX MARKET CLOSED · WEEKEND" : "● LIVE MULTI-SOURCE MARKET INTELLIGENCE"}</div>
      <div className="mx-auto max-w-[1450px] p-5 lg:p-7">
        <header className="rounded-[26px] border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.07),transparent_32%),#08131a] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">PAL · MARKET INTELLIGENCE</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{closed ? "Market Intelligence Dashboard" : `${now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} · ${String(now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long" }))} Session`}</h1><div className="mt-1 text-xs text-zinc-500">{dateIST(now)} · IST · Evidence-backed macro, news & economic catalysts</div></div><div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 text-right"><div className="font-mono text-lg">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">LIVE IST</div></div></div>
          <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-600">SESSION REGIME</div><div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-semibold">{macro.headline || "Current macro picture"}</h2><p className="mt-1 max-w-3xl text-[10px] text-zinc-500">{macro.summary || "PAL is combining current macro evidence and scheduled catalysts."}</p></div><span className={`w-fit rounded-lg border px-3 py-2 text-[9px] font-black ${regime === "DIRECTIONAL" ? "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300" : regime === "EVENT-DRIVEN" ? "border-amber-300/20 bg-amber-300/[.07] text-amber-300" : "border-white/[.08] text-zinc-400"}`}>{regime}</span></div></div>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-2"><BiasCard label="DXY" value={dxy} confidence={dxyConf} reasons={macro.dxy?.reasons ?? macroBias.dxy?.reasons ?? []}/><BiasCard label="GBP / USD" value={pair} confidence={pairConf} reasons={macro.gbpusd?.reasons ?? macroBias.gbpusd?.reasons ?? []}/></section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3"><article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-600">Relationship</div><div className={`mt-2 text-2xl font-black ${alignment.includes("USD") ? "text-red-300" : alignment.includes("GBP") ? "text-emerald-300" : "text-amber-300"}`}>{alignment.includes("_") ? alignment.replace("_", " ") : alignment}</div><div className="mt-1 text-[9px] text-zinc-600">DXY and GBP/USD macro relationship</div></article><article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-600">Upcoming</div><div className="mt-2 text-2xl font-black text-amber-300">{upcoming.length || 0}</div><div className="mt-1 text-[9px] text-zinc-600">catalysts on the radar</div></article><article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-600">Fresh News</div><div className="mt-2 text-2xl font-black text-cyan-300">{headlines.length || 0}</div><div className="mt-1 text-[9px] text-zinc-600">current macro headlines</div></article></section>

        {visibleEvents.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081219] overflow-hidden"><div className="border-b border-white/[.06] px-5 py-4 flex items-center justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">Major events · IST</div><h2 className="mt-1 text-lg font-semibold">Economic calendar</h2></div><span className="text-[8px] text-zinc-600">provider-backed</span></div><div className="divide-y divide-white/[.05]">{visibleEvents.map((e:any,i:number) => { const released = recent.some((r:any) => (r.id ?? `${r.title}${r.time}`) === (e.id ?? `${e.title}${e.time}`)); const url = sourceUrl(e); return <div key={e.id ?? i} className="grid gap-3 px-5 py-4 md:grid-cols-[100px_1fr_150px]"><div><div className="text-[8px] text-zinc-700">{dateIST(e.time)}</div><div className="mt-1 text-sm font-semibold text-cyan-300">{timeIST(e.time)}</div></div><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{e.title}</span><span className={`rounded-md border px-2 py-1 text-[8px] font-bold ${String(e.impact ?? "").toUpperCase().includes("HIGH") ? "border-red-300/20 bg-red-300/[.06] text-red-300" : "border-amber-300/20 bg-amber-300/[.05] text-amber-300"}`}>{e.impact ?? "MEDIUM"}</span><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-500">{e.currency ?? "—"}</span><span className="text-[8px] uppercase text-zinc-700">{released ? "RELEASED" : "UPCOMING"}</span></div>{(e.actual ?? e.forecast ?? e.previous) != null && <div className="mt-2 grid grid-cols-3 gap-2 text-[8px] text-zinc-600"><span>Actual <b className="text-zinc-400">{e.actual ?? "—"}</b></span><span>Forecast <b className="text-zinc-400">{e.forecast ?? "—"}</b></span><span>Previous <b className="text-zinc-400">{e.previous ?? "—"}</b></span></div>}</div><div className="flex items-center justify-start md:justify-end"><span className="text-[8px] text-zinc-600">{e.source ?? "Provider"}</span>{url && <a className="ml-2 text-[8px] text-cyan-300/70" href={url} target="_blank" rel="noreferrer">Verify ↗</a>}</div></div>; })}</div></section>}

        {headlines.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081219] overflow-hidden"><div className="border-b border-white/[.06] px-5 py-4 flex items-center justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-emerald-300/70">News intelligence</div><h2 className="mt-1 text-lg font-semibold">Latest macro headlines</h2></div><span className="text-[8px] text-zinc-600">{headlines.length} articles</span></div><div className="grid gap-3 p-4 lg:grid-cols-2">{headlines.slice(0, 6).map((h:any,i:number) => { const url = sourceUrl(h); return <article key={h.id ?? i} className="rounded-xl border border-white/[.05] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.16em] text-zinc-600">{h.currency ?? "CROSS"} · {h.source ?? h.provider ?? "Provider"}</span><span className="text-[8px] text-zinc-700">{timeIST(h.published_at ?? h.published)}</span></div><div className="mt-2 text-[11px] leading-5 text-zinc-300">{h.title}</div>{url && <a className="mt-2 inline-block text-[8px] text-cyan-300/70" href={url} target="_blank" rel="noreferrer">Open source ↗</a>}</article>; })}</div></section>}

        {highImpact.length > 0 && <section className="mt-4 rounded-2xl border border-red-300/10 bg-red-300/[.025] p-5"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-red-300">Risk radar</div><div className="mt-2 text-lg font-semibold">{highImpact.length} high-impact catalyst{highImpact.length > 1 ? "s" : ""}</div><div className="mt-1 text-[10px] text-zinc-500">Scheduled events are shown as risk until released; PAL does not use an upcoming event as fake directional evidence.</div></section>}

        <section className="mt-4 rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.06),transparent_35%),#081219] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">Final market verdict</div><div className="mt-1 text-2xl font-semibold">{finalVerdict}</div><div className="mt-1 text-[10px] text-zinc-500">DXY {dxy} · GBP/USD {pair} · {pairConf}% confidence · {alignment}</div></div><span className={`rounded-lg border px-4 py-2 text-[9px] font-black ${badge(pair)}`}>{pair}</span></div></section>

        <section className="mt-4 rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-600">Source verification</div><div className="mt-3 flex flex-wrap gap-2">{sourceNames.slice(0, 10).map((name:string) => { const url = SOURCES[name]; return url ? <a key={name} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/[.05] bg-black/20 px-3 py-2 text-[8px] text-zinc-400 hover:border-cyan-300/20">{name} ↗</a> : <span key={name} className="rounded-lg border border-white/[.05] px-3 py-2 text-[8px] text-zinc-600">{name}</span>; })}</div></section>
        <footer className="py-6 text-center text-[8px] uppercase tracking-[.18em] text-zinc-700">PAL · clean dashboard · source-attributed macro intelligence · no fabricated values</footer>
      </div>
    </main></div>
  </div>;
}
