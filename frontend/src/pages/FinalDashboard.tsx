import { useEffect, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import MarketCharts from "../components/market/MarketCharts";
import { usePAL } from "../hooks/usePAL";

type Props = { activePage: Page; onPageChange: (page: Page) => void };
type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

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
  if (text.includes("UNKNOWN") || text.includes("INSUFFICIENT") || text.includes("UNAVAILABLE") || text.includes("WARMING")) return "UNKNOWN";
  return "NEUTRAL";
}

function color(bias: Bias) {
  return bias === "BULLISH" ? "text-emerald-300" : bias === "BEARISH" ? "text-red-300" : bias === "UNKNOWN" ? "text-zinc-500" : "text-amber-300";
}

function dot(bias: Bias) {
  return bias === "BULLISH" ? "bg-emerald-300" : bias === "BEARISH" ? "bg-red-300" : bias === "UNKNOWN" ? "bg-zinc-600" : "bg-amber-300";
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

function sessionClock(name: "Asia" | "London" | "New York", now: Date) {
  const zones = { Asia: "Asia/Tokyo", London: "Europe/London", "New York": "America/New_York" };
  const labels = { Asia: "JST", London: "UK local", "New York": "US Eastern" };
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zones[name], hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return `${time} · ${labels[name]}`;
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
      <div className="flex items-start justify-between"><span className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-600">{title}</span><span className="text-right"><span className="block text-3xl font-semibold tabular-nums">{Math.round(safe)}%</span><span className="block text-[7px] font-bold uppercase tracking-[.16em] text-zinc-700">Evidence</span></span></div>
      <div className="mt-3 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${dot(bias)}`} /><span className={`text-2xl font-black ${color(bias)}`}>{bias}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className={`h-full rounded-full transition-all duration-700 ${bias === "BULLISH" ? "bg-emerald-300" : bias === "BEARISH" ? "bg-red-300" : bias === "UNKNOWN" ? "bg-zinc-600" : "bg-amber-300"}`} style={{ width: `${safe}%` }} /></div>
      {reasons.slice(0, 3).map((reason, index) => <div key={index} className="mt-3 flex gap-2 text-[10px] leading-4 text-zinc-400"><span className="text-cyan-300">•</span><span>{reason}</span></div>)}
    </article>
  );
}

export default function FinalDashboard({ activePage, onPageChange }: Props) {
  const { data, isLoading, error } = usePAL();
  const [now, setNow] = useState(() => new Date());
  const [rightNowOpen, setRightNowOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // All derived values are calculated before conditional returns so React hook order is stable.
  const report: any = data?.report ?? {};
  const macro: any = report.macro ?? {};
  const news: any = report.news ?? {};
  const macroBias: any = news.macro_bias ?? {};
  const todayBias: any = news.today_bias ?? {};
  const rightNow: any = todayBias.today?.right_now ?? {};
  const activeSession = todayBias.active_session ?? "No major session active";
  const markets: any = report.markets ?? news.markets ?? {};
  const evidence: any = macroBias.evidence ?? {};
  const upcoming: any[] = Array.isArray(news.upcoming_events) ? news.upcoming_events : [];
  const recent: any[] = Array.isArray(news.recent_events) ? news.recent_events : [];
  const headlines: any[] = Array.isArray(news.headlines) ? news.headlines : [];
  const dxyBias = getBias(macro.dxy?.bias ?? macroBias.dxy?.bias);
  const pairBias = getBias(macro.gbpusd?.bias ?? macroBias.gbpusd?.bias);
  const dxyConfidence = Number(macro.dxy?.confidence ?? macroBias.dxy?.confidence ?? 0);
  const pairConfidence = Number(macro.gbpusd?.confidence ?? macroBias.gbpusd?.confidence ?? 0);
  const goldAssetBias: any = todayBias.assets?.gold ?? {};
  const btcAssetBias: any = todayBias.assets?.btcusd ?? {};
  const relationship = dxyBias === "BULLISH" && pairBias === "BEARISH" ? "USD FAVOURED" : dxyBias === "BEARISH" && pairBias === "BULLISH" ? "GBP FAVOURED" : "MIXED";
  const highImpact = upcoming.some((event) => String(event?.impact ?? "").toUpperCase().includes("HIGH"));
  const weekdayIST = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
  const weekend = weekdayIST === "Sat" || weekdayIST === "Sun";
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
        <Sidebar symbol="GBPUSD" activePage={activePage} onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-cyan-300/10 bg-cyan-300/[.02] px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.24em] text-cyan-300">● LIVE MULTI-SOURCE MARKET INTELLIGENCE</div>
          <div className="mx-auto max-w-[1380px] p-5 lg:p-7">
            <header className="rounded-[26px] border border-cyan-300/10 bg-[#081219] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">PAL · MARKET INTELLIGENCE</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{activePage === "macro" ? "Macro Desk" : activePage === "calendar" ? "Economic Calendar" : condition === "MARKET CLOSED" ? "Market Dashboard" : `${activeSession} Session Dashboard`}</h1><div className="mt-1 text-xs text-zinc-500">{dateIST(now)} · IST · Macro, news and economic catalysts</div></div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 text-right"><div className="font-mono text-lg">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">LIVE IST</div></div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-700">SESSION REGIME</div><div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-semibold">{macro.headline || "Current USD and GBP macro conditions are being monitored."}</h2><p className="mt-1 text-[10px] text-zinc-500">{macro.summary || "PAL is combining released data, fresh headlines and scheduled catalysts."}</p></div><span className="w-fit rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[9px] font-black text-amber-300">{condition}</span></div></div>
            </header>

            <section className={`mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${activePage === "calendar" ? "hidden" : ""}`}><BiasCard title="DXY · TODAY MACRO BIAS" bias={dxyBias} confidence={dxyConfidence} reasons={dxyReasons} /><BiasCard title="GBP / USD · TODAY MACRO BIAS" bias={pairBias} confidence={pairConfidence} reasons={pairReasons} /><BiasCard title="GOLD · CROSS-ASSET BIAS" bias={getBias(goldAssetBias.bias)} confidence={Number(goldAssetBias.confidence ?? 0)} reasons={Array.isArray(goldAssetBias.reasons) ? goldAssetBias.reasons : []} /><BiasCard title="BITCOIN · CROSS-ASSET BIAS" bias={getBias(btcAssetBias.bias)} confidence={Number(btcAssetBias.confidence ?? 0)} reasons={Array.isArray(btcAssetBias.reasons) ? btcAssetBias.reasons : []} /></section>

            {activePage !== "calendar" && <MarketCharts markets={markets} />}

            <section className={`mt-4 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0a1d23] via-[#081219] to-[#111023] p-5 shadow-[0_0_35px_rgba(34,211,238,.07)] ${activePage !== "dashboard" ? "hidden" : ""}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">LIVE DECISION SUPPORT</div><h2 className="mt-2 text-xl font-semibold">Right Now Bias</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-zinc-400">Check the latest short-term momentum beside today's macro bias before you decide. This is a confirmation layer, not an instruction to enter a trade.</p></div>
                <button type="button" onClick={() => setRightNowOpen(true)} className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-[10px] font-black uppercase tracking-[.15em] text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,.13)] transition hover:bg-cyan-300/20 hover:shadow-[0_0_30px_rgba(34,211,238,.2)]">Analyse right now ↗</button>
              </div>
            </section>

            <section className={`mt-4 grid gap-3 sm:grid-cols-3 ${activePage !== "dashboard" ? "hidden" : ""}`}>
              {(["Asia","London","New York"] as const).map((name) => { const session = todayBias.sessions?.[name] ?? {}; return <article key={name} className="rounded-2xl border border-white/[.07] bg-[#081116] p-4 transition hover:border-cyan-300/20 hover:shadow-[0_0_24px_rgba(34,211,238,.06)]"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{name} session</span><span className={session.active ? "rounded-full bg-emerald-300/10 px-2 py-1 text-[8px] font-bold text-emerald-300" : "rounded-full bg-zinc-500/10 px-2 py-1 text-[8px] font-bold text-zinc-500"}>{session.active ? "ACTIVE" : "CLOSED"}</span></div><div className="mt-2 font-mono text-xs text-cyan-200">{sessionClock(name, now)}</div><div className={`mt-3 text-xl font-black ${color(getBias(session.bias))}`}>{session.bias ?? "WAITING FOR DATA"}</div><div className="mt-1 text-[9px] text-zinc-500">Today-only bias · {Math.round(Number(session.confidence ?? 0))}% confidence</div></article>; })}
            </section>

            {rightNowOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Right Now Bias analysis"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-cyan-300/20 bg-[#071117] p-5 shadow-[0_0_70px_rgba(34,211,238,.12)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">PAL · LIVE CONFIRMATION</div><h2 className="mt-2 text-2xl font-semibold">Right Now Bias</h2><p className="mt-1 text-[10px] text-zinc-500">Live minute momentum + today's macro context. Quotes may be delayed by the upstream provider.</p></div><button type="button" onClick={() => setRightNowOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">Close ✕</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{(["GBPUSD","DXY","XAUUSD","BTCUSD"] as const).map((key) => { const item = rightNow[key.toLowerCase()] ?? {}; const bias = getBias(item.bias); const momentum = item.momentum; const liveStatus = item.status ?? markets[key]?.right_now_status ?? "WARMING_UP"; const today = key === "GBPUSD" ? todayBias.today?.gbpusd?.bias : key === "DXY" ? todayBias.today?.dxy?.bias : key === "XAUUSD" ? todayBias.assets?.gold?.bias : todayBias.assets?.btcusd?.bias; const aligned = today && bias !== "UNKNOWN" && liveStatus === "CURRENT" ? getBias(today) === bias : null; return <article key={key} className="rounded-2xl border border-white/[.08] bg-black/25 p-4"><div className="text-[9px] font-bold tracking-[.16em] text-zinc-500">{key}</div><div className={`mt-3 text-xl font-black ${color(bias)}`}>{liveStatus !== "CURRENT" || bias === "UNKNOWN" ? "INSUFFICIENT DATA" : aligned === false ? "WAIT · CONFLICT" : item.bias ?? "WARMING UP"}</div><div className="mt-2 font-mono text-sm">{momentum == null ? "—" : `${Number(momentum) >= 0 ? "+" : ""}${Number(momentum).toFixed(4)}%`}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-zinc-600">{liveStatus}</div><div className="mt-3 rounded-lg border border-white/[.06] bg-white/[.02] p-2 text-[9px]">{today ? <><span className="text-zinc-500">Today's baseline: </span><b className={color(getBias(today))}>{today}</b><div className={`mt-1 font-bold ${aligned ? "text-emerald-300" : "text-amber-300"}`}>{aligned === true ? "ALIGNED" : aligned === false ? "CONFLICT · WAIT FOR CONFIRMATION" : "WAIT · COLLECTING DATA"}</div></> : <span className="text-zinc-500">Baseline unavailable for this asset.</span>}</div><div className="mt-3 text-[9px] leading-4 text-zinc-500">{key === "GBPUSD" ? "Compare today's GBP-vs-USD macro bias with short-term momentum." : key === "DXY" ? "USD strength context for major FX pairs." : key === "XAUUSD" ? "Gold uses futures as a proxy, plus available momentum and dollar/yield context." : "Bitcoin uses price momentum and available dollar context."}</div></article>; })}</div><div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-[10px] leading-5 text-amber-100/70">Use this as one confirmation only. If today's macro bias and the live momentum disagree, PAL should show a mixed / wait state rather than force a directional answer. Verify the chart structure, liquidity, risk and news timing yourself.</div></div></div>}

            {(upcoming.length > 0 || headlines.length > 0) && <section className={`mt-4 grid gap-4 lg:grid-cols-3 ${activePage !== "dashboard" ? "hidden" : ""}`}><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Relationship</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{relationship}</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Upcoming catalysts</div><div className="mt-2 text-2xl font-semibold text-amber-300">{upcoming.length}</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Fresh headlines</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{headlines.length}</div></div></section>}

            {upcoming.length > 0 && <section className={`mt-4 rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden ${activePage !== "calendar" ? "hidden" : ""}`}><div className="border-b border-white/[.06] px-5 py-4"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">MAJOR EVENTS · IST</div><h2 className="mt-1 text-lg font-semibold">Economic radar</h2></div><div className="divide-y divide-white/[.05]">{upcoming.slice(0, 8).map((event, index) => <div key={event.id ?? index} className="grid gap-3 px-5 py-4 md:grid-cols-[100px_minmax(0,1fr)_90px]"><div><div className="font-mono text-sm font-semibold text-cyan-300">{timeIST(event.time)}</div><div className="text-[8px] text-zinc-700">{event.currency ?? "—"}</div></div><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-zinc-200">{event.title}</span><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-600">{event.impact ?? "—"}</span></div>{(event.actual ?? event.forecast ?? event.previous) && <div className="mt-2 flex gap-4 text-[8px] text-zinc-600"><span>Actual <b className="text-zinc-300">{event.actual ?? "—"}</b></span><span>Forecast <b className="text-zinc-300">{event.forecast ?? "—"}</b></span><span>Previous <b className="text-zinc-300">{event.previous ?? "—"}</b></span></div>}</div><div className="text-right">{sourceUrl(event) && <a href={sourceUrl(event)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Verify ↗</a>}</div></div>)}</div></section>}

            {headlines.length > 0 && <section className={`mt-4 rounded-2xl border border-white/[.07] bg-[#081116] overflow-hidden ${activePage !== "macro" ? "hidden" : ""}`}><div className="border-b border-white/[.06] px-5 py-4"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">NEWS INTELLIGENCE</div><h2 className="mt-1 text-lg font-semibold">What matters now</h2></div><div className="divide-y divide-white/[.05]">{headlines.slice(0, 6).map((item, index) => <div key={item.id ?? index} className="px-5 py-4"><div className="flex justify-between gap-4"><span className="text-[10px] leading-5 text-zinc-300">{item.title}</span><span className="shrink-0 text-[8px] text-zinc-700">{timeIST(item.published_at ?? item.published)}</span></div><div className="mt-2 flex justify-between"><span className="text-[8px] text-zinc-700">{item.source ?? item.provider ?? "News provider"}</span>{sourceUrl(item) && <a href={sourceUrl(item)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Source ↗</a>}</div></div>)}</div></section>}

            {recent.length > 0 && <section className={`mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5 ${activePage !== "calendar" ? "hidden" : ""}`}><div className="text-[8px] uppercase tracking-[.2em] text-emerald-300/70">RELEASED DATA</div><h2 className="mt-1 text-lg font-semibold">Recent market catalysts</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{recent.slice(0, 6).map((event, index) => <div key={event.id ?? index} className="rounded-xl border border-white/[.05] bg-black/20 p-4"><div className="text-[8px] text-zinc-700">{timeIST(event.time)} · {event.currency ?? "—"}</div><div className="mt-2 text-[10px] font-semibold text-zinc-300">{event.title}</div>{(event.actual ?? event.forecast ?? event.previous) && <div className="mt-3 grid grid-cols-3 gap-2 text-[8px] text-zinc-600"><span>A <b className="text-zinc-300">{event.actual ?? "—"}</b></span><span>F <b className="text-zinc-300">{event.forecast ?? "—"}</b></span><span>P <b className="text-zinc-300">{event.previous ?? "—"}</b></span></div>}</div>)}</div></section>}

            <section className={`mt-4 grid gap-4 lg:grid-cols-2 ${activePage !== "macro" ? "hidden" : ""}`}><div className="rounded-2xl border border-amber-300/10 bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-amber-300/70">BIAS INVALIDATION</div><div className="mt-3 text-[10px] leading-5 text-zinc-500">The current bias weakens when the key USD/GBP catalyst reverses, major data surprises in the opposite direction, or rate expectations materially change.</div></div><div className="rounded-2xl border border-white/[.07] bg-[#081116] p-5"><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">MARKET SNAPSHOT</div><div className="mt-4 grid grid-cols-2 gap-2">{([['DXY','DXY'],['GBP/USD','GBPUSD'],['Gold','XAUUSD'],['Bitcoin','BTCUSD'],['US 10Y','US10Y']] as const).map(([label,key]) => { const q = markets[key] ?? {}; return <div key={key} className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="text-[9px] font-semibold text-zinc-300">{label}</div><div className="mt-2 font-mono text-sm">{price(q.price)}</div><div className="text-[9px] text-zinc-600">{pct(q.change_percent)}</div></div>; })}</div></div></section>

            {sourceNames.length > 0 && <section className={`mt-4 rounded-2xl border border-white/[.07] bg-[#081116] p-5 ${activePage !== "macro" ? "hidden" : ""}`}><div className="text-[8px] uppercase tracking-[.2em] text-cyan-300">SOURCE VERIFICATION</div><div className="mt-3 flex flex-wrap gap-2">{sourceNames.map((name: string) => <a key={name} href={SOURCES[name] || "https://news.google.com/"} target="_blank" rel="noreferrer" className="rounded-lg border border-white/[.05] bg-black/20 px-3 py-2 text-[8px] text-zinc-500">{name} ↗</a>)}</div></section>}

            <section className={`mt-4 rounded-[24px] border border-cyan-300/10 bg-[#081219] p-6 ${activePage !== "dashboard" ? "hidden" : ""}`}><div className="text-[8px] uppercase tracking-[.22em] text-cyan-300">FINAL MARKET VERDICT</div><h2 className="mt-2 text-2xl font-semibold">{verdict}</h2><div className="mt-2 text-xs text-zinc-500">DXY {dxyBias} · GBP/USD {pairBias} · {relationship}</div><div className="mt-3 text-[10px] leading-5 text-zinc-500">{pairReasons[0] || "The available evidence does not currently support a stronger directional conclusion."}</div></section>
            <footer className="py-6 text-center text-[8px] uppercase tracking-[.18em] text-zinc-800">PAL · source-attributed market intelligence</footer>
          </div>
        </main>
      </div>
    </div>
  );
}
