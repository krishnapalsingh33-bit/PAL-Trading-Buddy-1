import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import api from "../api/pal";
import Sidebar, { type Page } from "../components/layout/Sidebar";

type Props = { activePage?: Page; onPageChange?: (page: Page) => void };

type PairOption = { symbol: string; label: string; base: string; quote: string };

const PAIRS: PairOption[] = [
  ["EURUSD", "EUR/USD", "EUR", "USD"], ["GBPUSD", "GBP/USD", "GBP", "USD"], ["USDJPY", "USD/JPY", "USD", "JPY"],
  ["USDCHF", "USD/CHF", "USD", "CHF"], ["USDCAD", "USD/CAD", "USD", "CAD"], ["AUDUSD", "AUD/USD", "AUD", "USD"],
  ["NZDUSD", "NZD/USD", "NZD", "USD"], ["EURGBP", "EUR/GBP", "EUR", "GBP"], ["EURJPY", "EUR/JPY", "EUR", "JPY"],
  ["GBPJPY", "GBP/JPY", "GBP", "JPY"], ["AUDJPY", "AUD/JPY", "AUD", "JPY"], ["CADJPY", "CAD/JPY", "CAD", "JPY"],
  ["CHFJPY", "CHF/JPY", "CHF", "JPY"], ["EURAUD", "EUR/AUD", "EUR", "AUD"], ["EURCAD", "EUR/CAD", "EUR", "CAD"],
  ["EURNZD", "EUR/NZD", "EUR", "NZD"], ["GBPAUD", "GBP/AUD", "GBP", "AUD"], ["GBPCAD", "GBP/CAD", "GBP", "CAD"],
  ["GBPNZD", "GBP/NZD", "GBP", "NZD"], ["AUDCAD", "AUD/CAD", "AUD", "CAD"], ["AUDNZD", "AUD/NZD", "AUD", "NZD"],
  ["CADCHF", "CAD/CHF", "CAD", "CHF"], ["NZDCAD", "NZD/CAD", "NZD", "CAD"], ["NZDJPY", "NZD/JPY", "NZD", "JPY"],
].map(([symbol, label, base, quote]) => ({ symbol, label, base, quote }));

function normalizeBias(value: unknown): "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("BULL")) return "BULLISH";
  if (text.includes("BEAR")) return "BEARISH";
  if (text.includes("NEUTRAL")) return "NEUTRAL";
  return "UNKNOWN";
}

function biasClass(bias: string) {
  if (bias === "BULLISH") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-300";
  if (bias === "BEARISH") return "border-red-300/20 bg-red-300/10 text-red-300";
  if (bias === "NEUTRAL") return "border-amber-300/20 bg-amber-300/10 text-amber-300";
  return "border-white/10 bg-white/[.03] text-zinc-400";
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export default function ForexIntelligence({ activePage = "forex", onPageChange }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("GBPUSD");

  const filteredPairs = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return PAIRS;
    return PAIRS.filter((pair) => pair.symbol.includes(q) || pair.label.includes(q) || pair.base.includes(q) || pair.quote.includes(q));
  }, [query]);

  const pair = PAIRS.find((item) => item.symbol === selected) ?? PAIRS[0];
  const analysis = useQuery({
    queryKey: ["forex-intelligence", pair.symbol],
    queryFn: async () => (await api.get(`/pal/analyze/${pair.symbol}`)).data,
    refetchInterval: 15000,
  });

  const report: any = analysis.data?.report ?? {};
  const today: any = report.today?.today ?? report.today ?? {};
  const macro: any = report.macro ?? {};
  const pairBias = normalizeBias(today?.gbpusd?.bias ?? today?.[pair.symbol.toLowerCase()]?.bias ?? report?.bias);
  const reasons = safeArray(today?.gbpusd?.reasons ?? report?.reasons ?? macro?.gbpusd?.reasons);
  const events = safeArray(report?.news?.upcoming_events ?? report?.macro?.events ?? report?.news?.events);
  const headlines = safeArray(report?.news?.headlines ?? report?.news?.items ?? report?.news);

  return (
    <div className="min-h-screen bg-[#050607] text-zinc-100">
      <div className="flex min-h-screen">
        <Sidebar symbol={pair.symbol} activePage={activePage} onPageChange={onPageChange} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
            <section className="rounded-3xl border border-cyan-300/10 bg-gradient-to-br from-cyan-400/[.08] via-white/[.02] to-emerald-400/[.05] p-6 shadow-[0_30px_100px_-65px_rgba(34,211,238,.55)]">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[.24em] text-cyan-300">PAL PUBLIC MARKET INTELLIGENCE</div>
                  <h1 className="mt-2 text-3xl font-semibold text-white">Forex Intelligence</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Search a currency pair and review PAL's current directional evidence, macro context, economic events and headlines from the existing backend intelligence layer.</p>
                </div>
                <div className="w-full xl:w-[420px]">
                  <label className="text-[9px] uppercase tracking-[.2em] text-zinc-600">Search pair</label>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="EURUSD, USD/CAD, GBPJPY..." className="mt-2 w-full rounded-2xl border border-white/[.08] bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-cyan-300/30" />
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-white/[.06] bg-[#070b0d]">
                    {filteredPairs.slice(0, 10).map((item) => (
                      <button key={item.symbol} type="button" onClick={() => { setSelected(item.symbol); setQuery(""); }} className={`flex w-full items-center justify-between px-4 py-3 text-left text-xs transition hover:bg-white/[.04] ${item.symbol === pair.symbol ? "bg-white/[.03]" : ""}`}>
                        <span className="font-semibold text-white">{item.label}</span><span className="text-zinc-600">{item.base} · {item.quote}</span>
                      </button>
                    ))}
                    {!filteredPairs.length ? <div className="px-4 py-4 text-xs text-zinc-600">No supported pair found.</div> : null}
                  </div>
                </div>
              </div>
            </section>

            {analysis.isLoading ? <div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-8 text-sm text-zinc-500">Loading {pair.label} intelligence…</div> : null}
            {analysis.error ? <div className="mt-5 rounded-2xl border border-red-300/10 bg-red-300/[.035] p-6 text-sm text-red-200">PAL could not load {pair.label}. Check that the backend at 127.0.0.1:8000 is running.</div> : null}

            {!analysis.isLoading && !analysis.error ? <>
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
                <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><div className="text-[9px] uppercase tracking-[.2em] text-zinc-600">Selected market</div><h2 className="mt-2 text-2xl font-semibold text-white">{pair.label}</h2></div>
                    <span className={`rounded-xl border px-3 py-2 text-[10px] font-bold tracking-wider ${biasClass(pairBias)}`}>{pairBias}</span>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {["15M", "30M", "1H", "4H"].map((timeframe) => <div key={timeframe} className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[9px] uppercase tracking-[.18em] text-zinc-600">{timeframe}</div><div className={`mt-3 text-lg font-semibold ${biasClass(pairBias).split(" ").slice(-1)[0]}`}>{pairBias}</div><div className="mt-2 text-[9px] text-zinc-700">Uses current PAL analysis context</div></div>)}
                  </div>
                </section>
                <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-6">
                  <div className="text-[9px] uppercase tracking-[.2em] text-cyan-300">Evidence</div>
                  <h3 className="mt-2 text-lg font-semibold text-white">Why PAL sees it this way</h3>
                  <div className="mt-4 space-y-3">{reasons.slice(0, 5).map((reason, index) => <div key={`${String(reason)}-${index}`} className="rounded-xl border border-white/[.06] bg-black/20 p-3 text-xs leading-5 text-zinc-500">{String(reason)}</div>)}{!reasons.length ? <div className="rounded-xl border border-white/[.06] bg-black/20 p-4 text-xs text-zinc-600">No pair-specific explanation was returned by the current evidence layer.</div> : null}</div>
                </section>
              </div>

              <section className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-6">
                <div className="flex items-end justify-between gap-4"><div><div className="text-[9px] uppercase tracking-[.2em] text-amber-300">Economic events</div><h3 className="mt-2 text-xl font-semibold text-white">What can move {pair.label}</h3></div><div className="text-[9px] uppercase tracking-wider text-zinc-600">live backend feed</div></div>
                <div className="mt-4 space-y-2">{events.slice(0, 12).map((event, index) => <div key={`${event?.title ?? "event"}-${index}`} className="grid gap-2 rounded-xl border border-white/[.06] bg-black/20 p-4 md:grid-cols-[90px_70px_1fr_120px_120px] md:items-center"><span className="text-[9px] uppercase text-zinc-600">{event?.time ? new Date(event.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span><span className="font-mono text-xs font-semibold text-white">{event?.currency ?? "—"}</span><span className="text-xs text-zinc-300">{event?.title ?? event?.event ?? "Economic event"}</span><span className="text-[9px] uppercase text-zinc-500">Impact: {event?.impact ?? "—"}</span><span className="text-[9px] text-zinc-600">Actual {event?.actual ?? "—"} · Forecast {event?.forecast ?? "—"}</span></div>)}{!events.length ? <div className="rounded-xl border border-white/[.06] bg-black/20 p-5 text-xs text-zinc-600">No upcoming events are currently available in PAL's evidence feed.</div> : null}</div>
              </section>

              <section className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.02] p-6">
                <div className="text-[9px] uppercase tracking-[.2em] text-cyan-300">News intelligence</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Recent headlines</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{headlines.slice(0, 9).map((item, index) => <div key={`${item?.title ?? item?.headline ?? "headline"}-${index}`} className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-xs font-semibold leading-5 text-zinc-200">{item?.title ?? item?.headline ?? item?.name ?? "Headline"}</div><div className="mt-2 text-[9px] uppercase tracking-wider text-zinc-700">{item?.source ?? item?.publisher ?? "PAL News Feed"}</div></div>)}{!headlines.length ? <div className="rounded-xl border border-white/[.06] bg-black/20 p-5 text-xs text-zinc-600 md:col-span-2 lg:col-span-3">No recent headlines are currently available for this analysis request.</div> : null}</div>
              </section>

              <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.025] p-5 text-xs leading-5 text-zinc-500">PAL is evidence-first: this page surfaces the information returned by the connected PAL backend and does not invent missing price, news or event data.</div>
            </> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
