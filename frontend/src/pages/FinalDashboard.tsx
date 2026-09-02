import { useEffect, useMemo, useState } from "react";
import Sidebar, { type Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };
type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" | "WARMING UP" | "LEAN_BULLISH" | "LEAN_BEARISH";

const SOURCES: Record<string, string> = {
  "Google News": "https://news.google.com/",
  GDELT: "https://www.gdeltproject.org/",
  "Forex Factory": "https://www.forexfactory.com/calendar",
  Apify: "https://apify.com/",
  BLS: "https://www.bls.gov/schedule/news_release/",
  "Federal Reserve": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  Treasury: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  "U.S. Department of the Treasury": "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  FRED: "https://fred.stlouisfed.org/",
  "Federal Reserve Bank of St. Louis / FRED": "https://fred.stlouisfed.org/",
  "UK Office for National Statistics": "https://www.ons.gov.uk/releasecalendar",
  "UK ONS": "https://www.ons.gov.uk/releasecalendar",
  "Yahoo Finance": "https://finance.yahoo.com/",
};

function biasOf(value: unknown): Bias {
  const s = String(value ?? "").toUpperCase();
  if (s.includes("BULL")) return "BULLISH";
  if (s.includes("BEAR")) return "BEARISH";
  if (s.includes("WARM")) return "WARMING UP";
  if (s === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function biasTone(bias: Bias) {
  if (bias === "BULLISH") return "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300";
  if (bias === "BEARISH") return "border-red-300/20 bg-red-300/[.07] text-red-300";
  if (bias === "NEUTRAL") return "border-amber-300/20 bg-amber-300/[.06] text-amber-300";
  return "border-white/[.08] bg-white/[.025] text-zinc-500";
}

function strength(conf: number) {
  if (conf >= 75) return "STRONG";
  if (conf >= 55) return "MODERATE";
  if (conf >= 35) return "WEAK";
  return "LOW EVIDENCE";
}

function eventImpactClass(impact: unknown) {
  const s = String(impact ?? "").toUpperCase();
  if (s.includes("HIGH")) return "border-red-300/20 bg-red-300/[.06] text-red-300";
  if (s.includes("MEDIUM")) return "border-amber-300/20 bg-amber-300/[.06] text-amber-300";
  return "border-white/[.08] text-zinc-600";
}

function num(value: unknown, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

function pct(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
}

function timeIST(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

function dateIST(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short" });
}

function sourceUrl(item: any) {
  return item?.source_url || item?.url || SOURCES[item?.source] || SOURCES[item?.provider];
}

function observation(rows: any, key: string) {
  const values = rows?.[key];
  return Array.isArray(values) && values.length ? values[values.length - 1] : undefined;
}

function isWeekend(date: Date) {
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).formatToParts(date).find((p) => p.type === "weekday")?.value === "Sat" ? 6 : new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).formatToParts(date).find((p) => p.type === "weekday")?.value === "Sun" ? 0 : 1);
  return day === 0 || day === 6;
}

function sessionName(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  if (hour >= 17) return "New York";
  if (hour >= 11) return "London";
  return "Market";
}

function progress(value: number) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-cyan-300 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function biasCard(label: string, bias: Bias, confidence: number, strengthText: string, reasons: string[]) {
  const color = bias === "BULLISH" ? "bg-emerald-300" : bias === "BEARISH" ? "bg-red-300" : "bg-amber-300";
  return (
    <article className="rounded-2xl border border-white/[.07] bg-[#0a171c] p-5 shadow-[0_24px_70px_-55px_rgba(0,0,0,.9)]">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-500">{label}</div>
        <div className="text-3xl font-semibold tabular-nums text-white">{confidence}%</div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${color} shadow-[0_0_18px_rgba(255,255,255,.15)]`} />
        <span className={`text-2xl font-black tracking-tight ${bias === "BULLISH" ? "text-emerald-300" : bias === "BEARISH" ? "text-red-300" : "text-amber-300"}`}>{bias}</span>
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-[.18em] text-zinc-600">Confidence · {strengthText}</div>
      {progress(confidence)}
      <div className="mt-4 space-y-2">
        {reasons.slice(0, 3).map((reason, index) => (
          <div key={`${label}-${index}`} className="flex gap-2 text-[10px] leading-4 text-zinc-400">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            <span>{reason}</span>
          </div>
        ))}
      </div>
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

  const report: any = data?.report ?? {};
  const macro: any = report.macro ?? {};
  const today: any = report.today?.today ?? {};
  const macroBias: any = report.news?.macro_bias ?? {};
  const markets: Record<string, any> = report.markets ?? report.news?.markets ?? macro.markets ?? {};
  const rows = report.news?.macro_data?.observations ?? macro.macro_data?.observations ?? {};
  const headlines = Array.isArray(report.news?.headlines) ? report.news.headlines : [];
  const upcoming = Array.isArray(report.news?.upcoming_events) ? report.news.upcoming_events : [];
  const recent = Array.isArray(report.news?.recent_events) ? report.news.recent_events : [];
  const allSources = Array.from(new Set([
    ...(Array.isArray(report.news?.calendar_sources) ? report.news.calendar_sources : []),
    ...(Array.isArray(macroBias?.evidence?.sources) ? macroBias.evidence.sources : []),
    "Google News",
    "GDELT",
    "BLS",
    "Federal Reserve",
    "UK Office for National Statistics",
  ]));

  const dxyBias = biasOf(macro.dxy?.bias ?? macroBias.dxy?.bias);
  const pairBias = biasOf(macro.gbpusd?.bias ?? macroBias.gbpusd?.bias);
  const dxyConf = Number(macro.dxy?.confidence ?? macroBias.dxy?.confidence ?? 0);
  const pairConf = Number(macro.gbpusd?.confidence ?? macroBias.gbpusd?.confidence ?? 0);
  const alignment = String(macroBias?.alignment ?? "MIXED").toUpperCase();
  const evidence = macroBias?.evidence ?? {};
  const isClosed = isWeekend(now);
  const activeSession = sessionName(now);
  const marketEvents = [...upcoming, ...recent].slice(0, 8);
  const highImpact = upcoming.filter((event: any) => String(event?.impact ?? "").toUpperCase().includes("HIGH")).length;
  const condition = isClosed ? "MARKET CLOSED" : highImpact > 0 ? "EVENT-DRIVEN" : pairConf >= 60 ? "DIRECTIONAL" : "MIXED / WATCH";
  const finalAction = pairBias === "BULLISH" && pairConf >= 60 ? "GBP/USD UPSIDE BIAS" : pairBias === "BEARISH" && pairConf >= 60 ? "GBP/USD DOWNSIDE BIAS" : "NO STRONG DIRECTION";

  const marketRows = useMemo(() => [
    ["DXY", "DXY", "Dollar Index"],
    ["GBP/USD", "GBPUSD", "Cable"],
    ["US 10Y", "US10Y", "Treasury yield"],
    ["WTI", "USOIL", "Crude oil"],
    ["US500", "US500", "S&P 500"],
    ["Gold", "XAUUSD", "Spot gold"],
  ] as const, []);

  if (isLoading) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-zinc-400">Loading PAL Market Intelligence…</div>;
  if (error || !data?.report) return <div className="min-h-screen bg-[#05080b] grid place-items-center text-red-300">PAL data feed unavailable. Check the backend and refresh.</div>;

  return (
    <div className="min-h-screen bg-[#05080b] text-white">
      <div className="flex min-h-screen">
        <Sidebar symbol="GBPUSD" activePage="dashboard" onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className={`border-b px-5 py-2 text-center text-[9px] font-bold uppercase tracking-[.25em] ${isClosed ? "border-amber-300/10 bg-amber-300/[.04] text-amber-300" : "border-cyan-300/10 bg-cyan-300/[.025] text-cyan-300"}`}>
            {isClosed ? "FX MARKET CLOSED · WEEKEND" : "● LIVE MARKET INTELLIGENCE · MULTI-SOURCE"}
          </div>

          <div className="mx-auto max-w-[1500px] p-5 lg:p-7">
            <header className="rounded-[28px] border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.08),transparent_34%),#08131a] p-6 shadow-[0_30px_100px_-65px_rgba(34,211,238,.55)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">PAL · MARKET INTELLIGENCE</div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">{activeSession} Session Dashboard</h1>
                  <div className="mt-1 text-xs text-zinc-500">{dateIST(now)} · India Standard Time · Evidence-backed macro, news & event radar</div>
                </div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 px-4 py-3 text-right">
                  <div className="font-mono text-lg tabular-nums text-zinc-200">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}</div>
                  <div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">LIVE IST</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/[.06] bg-black/20 p-4">
                <div className="text-[8px] font-bold uppercase tracking-[.2em] text-zinc-600">SESSION REGIME</div>
                <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{macro.headline || `${condition} · evidence-led market state`}</h2>
                    <div className="mt-1 text-[10px] text-zinc-500">{macro.summary || "PAL is aggregating current macro evidence and scheduled catalysts."}</div>
                  </div>
                  <span className={`w-fit rounded-lg border px-3 py-2 text-[9px] font-black ${condition === "DIRECTIONAL" ? "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300" : condition === "EVENT-DRIVEN" ? "border-amber-300/20 bg-amber-300/[.07] text-amber-300" : "border-white/[.08] bg-white/[.025] text-zinc-400"}`}>{condition}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Released evidence</div><div className="mt-2 text-2xl font-semibold">{Number(evidence.released_events ?? recent.length) || 0}</div><div className="text-[9px] text-zinc-600">actual / forecast observations</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Upcoming catalysts</div><div className="mt-2 text-2xl font-semibold text-amber-300">{upcoming.length}</div><div className="text-[9px] text-zinc-600">future events shown as risk, not bias</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Macro headlines</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{headlines.length}</div><div className="text-[9px] text-zinc-600">Google News + GDELT merged</div></div>
                <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Evidence sources</div><div className="mt-2 text-2xl font-semibold text-emerald-300">{allSources.length}</div><div className="text-[9px] text-zinc-600">provider links visible below</div></div>
              </div>
            </header>

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              {biasCard("DXY / USD", dxyBias, dxyConf, strength(dxyConf), macro.dxy?.reasons ?? macroBias.dxy?.reasons ?? [])}
              {biasCard("GBP / USD", pairBias, pairConf, strength(pairConf), macro.gbpusd?.reasons ?? macroBias.gbpusd?.reasons ?? [])}
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.75fr]">
              <article className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#08131a]">
                <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4">
                  <div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">MAJOR EVENTS · IST</div><h2 className="mt-1 text-lg font-semibold">Upcoming + recently released</h2></div>
                  <span className={`rounded-lg border px-3 py-2 text-[9px] font-black ${alignment === "MIXED" ? "border-amber-300/15 bg-amber-300/[.04] text-amber-300" : "border-emerald-300/15 bg-emerald-300/[.04] text-emerald-300"}`}>{alignment}</span>
                </div>
                <div className="divide-y divide-white/[.05]">
                  {marketEvents.map((event: any, index: number) => {
                    const released = recent.some((item: any) => String(item?.id ?? `${item?.title}-${item?.time}`) === String(event?.id ?? `${event?.title}-${event?.time}`));
                    return (
                      <div key={event?.id ?? index} className="grid gap-3 px-5 py-4 md:grid-cols-[95px_minmax(0,1fr)_130px]">
                        <div><div className="text-[8px] uppercase text-zinc-700">{dateIST(event?.time)}</div><div className="mt-1 text-base font-bold text-cyan-300">{timeIST(event?.time)}</div></div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{event?.title}</span><span className={`rounded-md border px-2 py-1 text-[8px] font-black ${eventImpactClass(event?.impact)}`}>{event?.impact ?? "—"}</span><span className="rounded-md border border-white/[.06] px-2 py-1 text-[8px] text-zinc-500">{event?.currency ?? "—"}</span><span className={`rounded-md border px-2 py-1 text-[8px] ${released ? "border-red-300/15 bg-red-300/[.04] text-red-300" : "border-cyan-300/15 bg-cyan-300/[.04] text-cyan-300"}`}>{released ? "RELEASED" : "UPCOMING"}</span></div>
                          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-white/[.04] bg-black/15 px-3 py-2 text-[8px] text-zinc-600"><span>Actual <b className="text-zinc-300">{event?.actual ?? "—"}</b></span><span>Forecast <b className="text-zinc-300">{event?.forecast ?? "—"}</b></span><span>Previous <b className="text-zinc-300">{event?.previous ?? "—"}</b></span></div>
                        </div>
                        <div className="flex flex-col justify-center md:items-end"><div className="text-[8px] text-zinc-600">{event?.source ?? "Provider"}</div>{sourceUrl(event) ? <a className="mt-1 text-[8px] text-cyan-300/70" href={sourceUrl(event)} target="_blank" rel="noreferrer">Verify source ↗</a> : null}</div>
                      </div>
                    );
                  })}
                  {!marketEvents.length ? <div className="p-10 text-center text-xs text-zinc-600">No current USD/GBP events returned by the connected feeds.</div> : null}
                </div>
              </article>

              <article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5">
                <div className="text-[9px] font-bold uppercase tracking-[.2em] text-amber-300/80">MARKET CONDITION</div>
                <div className="mt-2 text-2xl font-black text-amber-300">{condition}</div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/[.05] bg-black/15 px-3 py-3 text-[10px]"><span className="text-zinc-600">DXY ↔ GBP/USD</span><b className={alignment === "MIXED" ? "text-amber-300" : "text-emerald-300"}>{alignment}</b></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[.05] bg-black/15 px-3 py-3 text-[10px]"><span className="text-zinc-600">High-impact catalysts</span><b className="text-red-300">{highImpact}</b></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[.05] bg-black/15 px-3 py-3 text-[10px]"><span className="text-zinc-600">Macro confidence</span><b className="text-cyan-300">{pairConf}%</b></div>
                </div>
                <div className="mt-5 rounded-xl border border-white/[.05] bg-black/15 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Confirmed vs inference</div><div className="mt-2 text-[10px] leading-4 text-zinc-400">Calendar actual/forecast values are confirmed feed observations. Direction and confidence are PAL's inference from the current evidence set.</div></div>
              </article>
            </section>

            <section className="mt-4 rounded-2xl border border-white/[.07] bg-[#08131a] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">NEWS INTELLIGENCE</div><h2 className="mt-1 text-lg font-semibold">Latest macro headlines</h2></div><span className="text-[8px] uppercase tracking-[.15em] text-zinc-600">source-linked</span></div>
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                {headlines.slice(0, 6).map((headline: any, index: number) => (
                  <article key={headline?.id ?? index} className="rounded-xl border border-white/[.05] bg-black/20 p-4 transition hover:border-cyan-300/15">
                    <div className="flex flex-wrap gap-2"><span className={`rounded-md border px-2 py-1 text-[8px] font-black ${eventImpactClass(headline?.impact)}`}>{headline?.impact ?? "NEWS"}</span><span className="text-[8px] text-zinc-600">{headline?.currency ?? "CROSS"}</span><span className="text-[8px] text-zinc-600">{timeIST(headline?.published_at ?? headline?.published)}</span></div>
                    <div className="mt-2 text-[11px] leading-5 text-zinc-300">{headline?.title}</div>
                    <div className="mt-3 flex items-center justify-between"><span className="text-[8px] text-zinc-600">{headline?.source ?? headline?.provider ?? "Provider"}</span>{sourceUrl(headline) ? <a href={sourceUrl(headline)} target="_blank" rel="noreferrer" className="text-[8px] text-cyan-300/70">Open source ↗</a> : null}</div>
                  </article>
                ))}
                {!headlines.length ? <div className="p-8 text-center text-xs text-zinc-600 lg:col-span-2">No fresh macro headlines returned.</div> : null}
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.8fr]">
              <article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5">
                <div className="flex items-center justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-emerald-300/70">MARKET DATA</div><h2 className="mt-1 text-lg font-semibold">Cross-asset snapshot</h2></div><span className="text-[8px] text-zinc-600">live/provider-backed where available</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {marketRows.map(([label, key, subtitle]) => { const quote = markets[key] ?? {}; return <div key={key} className="rounded-xl border border-white/[.05] bg-black/20 p-4"><div className="flex justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-zinc-600">{label}</div><div className="mt-1 text-[8px] text-zinc-700">{subtitle}</div></div><span className="text-[8px] text-zinc-700">{quote?.source ?? "—"}</span></div><div className="mt-4 flex items-end justify-between"><span className="text-xl font-semibold tabular-nums">{num(quote?.price)}</span><span className={`text-xs font-semibold ${Number(quote?.change_percent) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{pct(quote?.change_percent)}</span></div><div className="mt-2 text-[8px] text-zinc-700">Status · {quote?.status ?? "—"}</div></div>; })}
                </div>
              </article>
              <article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5">
                <div className="text-[9px] font-bold uppercase tracking-[.2em] text-emerald-300/70">RATES & RISK PULSE</div>
                <div className="mt-4 space-y-2">
                  {[["Fed Funds", "fed_funds"], ["US 2Y", "us_2y"], ["US 10Y", "us_10y"], ["10Y–2Y", "us_10y_2y_spread"], ["VIX", "vix"]].map(([label, key]) => { const item = observation(rows, key); return <div key={key} className="flex items-center justify-between rounded-xl border border-white/[.05] bg-black/20 px-3 py-3"><span className="text-[10px] text-zinc-600">{label}</span><span className="font-mono text-xs font-semibold">{num(item?.value)}</span></div>; })}
                </div>
              </article>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-red-300/10 bg-red-300/[.02] p-5"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-red-300/80">BIAS INVALIDATION</div><div className="mt-3 space-y-2"><div className="rounded-xl border border-white/[.05] bg-black/15 p-3 text-[10px] leading-4 text-zinc-500">DXY bullish evidence weakens when fresh U.S. data materially disappoints, yields fall, or Fed expectations reprice dovishly.</div><div className="rounded-xl border border-white/[.05] bg-black/15 p-3 text-[10px] leading-4 text-zinc-500">GBP/USD bearish evidence weakens when fresh UK data surprises positively or USD evidence reverses.</div></div></article>
              <article className="rounded-2xl border border-white/[.07] bg-white/[.018] p-5"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300/80">DATA SOURCES</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{allSources.map((name) => <a key={name} href={SOURCES[name] ?? "#"} target={SOURCES[name] ? "_blank" : undefined} rel="noreferrer" className="rounded-xl border border-white/[.05] bg-black/20 px-3 py-2.5 hover:border-cyan-300/15"><div className="text-[9px] font-semibold text-zinc-300">{name}</div><div className="mt-1 text-[8px] text-cyan-300/60">Verify provider ↗</div></a>)}</div></article>
            </section>

            <section className="mt-4 rounded-2xl border border-cyan-300/10 bg-[linear-gradient(105deg,rgba(34,211,238,.045),rgba(16,185,129,.025))] p-5 shadow-[0_24px_80px_-60px_rgba(34,211,238,.35)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">FINAL MARKET VERDICT</div><h2 className="mt-2 text-2xl font-semibold">{finalAction}</h2><p className="mt-2 text-[10px] text-zinc-500">DXY {dxyBias} · GBP/USD {pairBias} · alignment {alignment} · confidence {pairConf}%</p></div>
                <div className="flex flex-wrap gap-2"><span className={`rounded-lg border px-3 py-2 text-[9px] font-black ${biasTone(dxyBias)}`}>DXY {dxyConf}%</span><span className={`rounded-lg border px-3 py-2 text-[9px] font-black ${biasTone(pairBias)}`}>GBP/USD {pairConf}%</span><span className="rounded-lg border border-white/[.08] bg-white/[.025] px-3 py-2 text-[9px] font-black text-zinc-400">{condition}</span></div>
              </div>
            </section>

            <footer className="py-6 text-center text-[8px] uppercase tracking-[.18em] text-zinc-700">PAL · dashboard-only workspace · fundamental/news intelligence · source-attributed evidence · no execution rules</footer>
          </div>
        </main>
      </div>
    </div>
  );
}
