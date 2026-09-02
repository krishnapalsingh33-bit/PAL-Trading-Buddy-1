import { useEffect, useState } from "react";
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
  Treasury: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  "Yahoo Finance": "https://finance.yahoo.com/",
};

function getBias(value: unknown): Bias {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("BULL")) return "BULLISH";
  if (text.includes("BEAR")) return "BEARISH";
  return "NEUTRAL";
}

function color(bias: Bias) {
  return bias === "BULLISH" ? "text-emerald-300" : bias === "BEARISH" ? "text-red-300" : "text-amber-300";
}

function dot(bias: Bias) {
  return bias === "BULLISH" ? "bg-emerald-300" : bias === "BEARISH" ? "bg-red-300" : "bg-amber-300";
}

function timeIST(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

function dateIST(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function pct(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
}

function price(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
}

function sourceUrl(item: any) {
  return item?.source_url || item?.url || SOURCES[item?.source] || SOURCES[item?.provider];
}

function BiasCard({ title, bias, confidence, reasons }: { title: string; bias: Bias; confidence: number; reasons: string[] }) {
  const safe = Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0;
  return (
    <article className="rounded-2xl border border-white/[.07] bg-[#0a151a] p-5">
      <div className="flex items-start justify-between"><span className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-600">{title}</span><span className="text-3xl font-semibold tabular-nums">{Math.round(safe)}%</span></div>
      <div className="mt-3 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${dot(bias)}`} /><span className={`text-2xl font-black ${color(bias)}`}>{bias}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${safe}%` }} /></div>
      {reasons.slice(0, 3).map((reason, index) => <div key={index} className="mt-3 flex gap-2 text-[10px] leading-4 text-zinc-400"><span className="text-cyan-300">•</span><span>{reason}</span></div>)}
    </article>
  );
}

export default function FinalDashboard({ onPageChange }: Props) {
  const { data, isLoading, error } = usePAL();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // All derived values are calculated before conditional returns so React hook order is stable.
  const report: any = data?.report ?? {};
  const macro: any = report.macro ?? {};
  const news: any = report.news ?? {};
  const macroBias: any = news.macro_bias ?? {};
  const markets: any = report.markets ?? news.markets ?? {};
  const evidence: any = macroBias.evidence ?? {};
  const upcoming: any[] = Array.isArray(news.upcoming_events) ? news.upcoming_events : [];
  const recent: any[] = Array.isArray(news.recent_events) ? news.recent_events : [];
  const headlines: any[] = Array.isArray(news.headlines) ? news.headlines : [];
  const dxyBias = getBias(macro.dxy?.bias ?? macroBias.dxy?.bias);
  const pairBias = getBias(macro.gbpusd?.bias ?? macroBias.gbpusd?.bias);
  const dxyConfidence = Number(macro.dxy?.confidence ?? macroBias.dxy?.confidence ?? 0);
  const pairConfidence = Number(macro.gbpusd?.confidence ?? macroBias.gbpusd?.confidence ?? 0);
  const relationship = dxyBias === "BULLISH" && pairBias === "BEARISH" ? "USD FAVOURED" : dxyBias === "BEARISH" && pairBias === "BULLISH" ? "GBP FAVOURED" : "MIXED";
  const highImpact = upcoming.some((event) => String(event?.impact ?? "").toUpperCase().includes("HIGH"));
  const weekend = [0, 6].includes(new Date(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(now)).getDay());
  const condition = weekend ? "MARKET CLOSED" : highImpact ? "EVENT-DRIVEN" : pairConfidence >= 60 ? "DIRECTIONAL" : "MIXED / WATCH";
  const verdict = pairBias === "BULLISH" ? "GBP/USD upside bias" : pairBias === "BEARISH" ? "GBP/USD downside bias" : "No strong GBP/USD direction";
  const dxyReasons: string[] = Array.isArray(macro.dxy?.reasons) ? macro.dxy.reasons : Array.isArray(macroBias.dxy?.reasons) ? macroBias.dxy.reasons : [];
  const pairReasons: string[] = Array.isArray(macro.gbpusd?.reasons) ? macro.gbpusd.reasons : Array.isArray(macroBias.gbpusd?.reasons) ? macroBias.gbpusd.reasons : [];
  const sourceNames = Array.from(new Set([...(Array.isArray(news.calendar_sources) ? news.calendar_sources : []), ...(Array.isArray(evidence.sources) ? evidence.sources : [])]));

  if (isLoading) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-zinc-400">Loading PAL Market Intelligence…</div>;
  if (error) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-center p-8"><div><div className="text-lg font-semibold text-red-300">PAL data feed unavailable</div><div className="mt-2 text-xs text-zinc-500">Keep the backend running on 127.0.0.1:8000 and refresh.</div></div></div>;

  return (
    <div className="min-h-screen bg-[#05080b] text-white">
      <div className="flex min-h-screen">
        <Sidebar symbol="GBPUSD" activePage="dashboard" onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-cyan-300/10 bg-cyan-300/[.02] px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.24em] text-cyan-300">● LIVE MULTI-SOURCE MARKET INTELLIGENCE</div>
          <div className="mx-auto max-w-[1380px] p-5 lg:p-7">
            <header className="rounded-[26px] border border-cyan-300/10 bg-[#081219] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">PAL · MARKET INTELLIGENCE</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{condition === "MARKET CLOSED" ? "Market Dashboard" : `${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(now) >= "17" ? "New York" : "London"} Session Dashboard`}</h1><div className="mt-1 text-xs text-zinc-500">{dateIST(now)} · IST · Macro, news and economic catalysts</div></div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 text-right"><div className="font-mono text-lg">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">LIVE IST</div></div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-700">SESSION REGIME</div><div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-semibold">{macro.headline || "Current USD and GBP macro conditions are being monitored."}</h2><p className="mt-1 text-[10px] text-zinc-500">{macro.summary || "PAL is combining released data, fresh headlines and scheduled catalysts."}</p></div><span className="w-fit rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[9px] font-black text-amber-300">{condition}</span></div></div>
            </header>

            <section className="mt-4 grid gap-4 lg:grid-cols-2"><BiasCard title="DXY" bias={dxyBias} confidence={dxyConfidence} reasons={dxyReasons} /><BiasCard title="GBP / USD" bias={pairBias} confidence={pairConfidence} reasons={pairReasons} /></section>

            {(upcoming.length > 0 || headlines.length > 0) && <section className="mt-4 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Relationship</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{relationship}</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Upcoming catalysts</div><div className="mt-2 text-2xl font-semibold text-amber-300">{upcoming.length}</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Fresh headlines</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{headlines.length}</div></div></section>}

            {upcoming.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden"><div className="border-b border-white/[.06] px-5 py-4"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">MAJOR EVENTS · IST</div><h2 className="mt-1 text-lg font-semibold">Economic radar</h2></div><div className="divide-y divide-white/[.05]">{upcoming.slice(0, 8).map((event, index) => <div key={event.id ?? index} className="grid gap-3 px-5 py-4 md:grid-cols-[100px_minmax(0,1fr)_90px]"><div><div className="font-mono text-sm font-semibold text-cyan-300">{timeIST(event.time)}</div><div className="text-[8px] text-zinc-700">{event.currency ?? "—"}</div></div><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-zinc-200">{event.title}</span><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-600">{event.impact ?? "—"}</span></div>{(event.actual ?? event.forecast ?? event.previous) && <div className="mt-2 flex gap-4 text-[8px] text-zinc-600"><span>Actual <b className="text-zinc-300">{event.actual ?? "—"}</b></span><span>Forecast <b className="text-zinc-300">{event.forecast ?? "—"}</b></span><span>Previous <b className="text-zinc-300">{event.previous ?? "—"}</b></span></div>}</div><div className="text-right">{sourceUrl(event) && <a href={sourceUrl(event)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Verify ↗</a>}</div></div>)}</div></section>}

            {headlines.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden"><div className="border-b border-white/[.06] px-5 py-4"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">NEWS INTELLIGENCE</div><h2 className="mt-1 text-lg font-semibold">What matters now</h2></div><div className="divide-y divide-white/[.05]">{headlines.slice(0, 6).map((item, index) => <div key={item.id ?? index} className="px-5 py-4"><div className="flex justify-between gap-4"><span className="text-[10px] leading-5 text-zinc-300">{item.title}</span><span className="shrink-0 text-[8px] text-zinc-700">{timeIST(item.published_at ?? item.published)}</span></div><div className="mt-2 flex justify-between"><span className="text-[8px] text-zinc-700">{item.source ?? item.provider ?? "News provider"}</span>{sourceUrl(item) && <a href={sourceUrl(item)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Source ↗</a>}</div></div>)}</div></section>}

            {recent.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-emerald-300/70">RELEASED DATA</div><h2 className="mt-1 text-lg font-semibold">Recent market catalysts</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{recent.slice(0, 6).map((event, index) => <div key={event.id ?? index} className="rounded-xl border border-white/[.05] bg-black/20 p-4"><div className="text-[8px] text-zinc-700">{timeIST(event.time)} · {event.currency ?? "—"}</div><div className="mt-2 text-[10px] font-semibold text-zinc-300">{event.title}</div>{(event.actual ?? event.forecast ?? event.previous) && <div className="mt-3 grid grid-cols-3 gap-2 text-[8px] text-zinc-600"><span>A <b className="text-zinc-300">{event.actual ?? "—"}</b></span><span>F <b className="text-zinc-300">{event.forecast ?? "—"}</b></span><span>P <b className="text-zinc-300">{event.previous ?? "—"}</b></span></div>}</div>)}</div></section>}

            <section className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-amber-300/10 bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-amber-300/70">BIAS INVALIDATION</div><div className="mt-3 text-[10px] leading-5 text-zinc-500">The current bias weakens when the key USD/GBP catalyst reverses, major data surprises in the opposite direction, or rate expectations materially change.</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">MARKET SNAPSHOT</div><div className="mt-4 grid grid-cols-2 gap-2">{([['DXY','DXY'],['GBP/USD','GBPUSD'],['US 10Y','US10Y'],['Gold','XAUUSD']] as const).map(([label,key]) => { const q = markets[key] ?? {}; return <div key={key} className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="text-[9px] font-semibold text-zinc-300">{label}</div><div className="mt-2 font-mono text-sm">{price(q.price)}</div><div className="text-[9px] text-zinc-600">{pct(q.change_percent)}</div></div>; })}</div></div></section>

            {sourceNames.length > 0 && <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">SOURCE VERIFICATION</div><div className="mt-3 flex flex-wrap gap-2">{sourceNames.map((name: string) => <a key={name} href={SOURCES[name] || "https://news.google.com/"} target="_blank" rel="noreferrer" className="rounded-lg border border-white/[.05] bg-black/20 px-3 py-2 text-[8px] text-zinc-500">{name} ↗</a>)}</div></section>}

            <section className="mt-4 rounded-[24px] border border-cyan-300/10 bg-[#081219] p-6"><div className="text-[8px] uppercase tracking-[.22em] text-cyan-300">FINAL MARKET VERDICT</div><h2 className="mt-2 text-2xl font-semibold">{verdict}</h2><div className="mt-2 text-xs text-zinc-500">DXY {dxyBias} · GBP/USD {pairBias} · {relationship}</div><div className="mt-3 text-[10px] leading-5 text-zinc-500">{pairReasons[0] || "The available evidence does not currently support a stronger directional conclusion."}</div></section>
            <footer className="py-6 text-center text-[8px] uppercase tracking-[.18em] text-zinc-800">PAL · source-attributed market intelligence</footer>
          </div>
        </main>
      </div>
    </div>
  );
}
