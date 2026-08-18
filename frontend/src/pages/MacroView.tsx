import { useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";
import type { MarketQuote } from "../types/pal";

type Props = { onPageChange: (page: Page) => void };

const MARKETS = [
    ["us500", "US500", "US Equity Index"],
    ["gbpusd", "GBP/USD", "Sterling vs Dollar"],
    ["dxy", "DXY", "US Dollar Index"],
    ["gold", "Gold", "XAU/USD"],
    ["oil", "Oil", "WTI / Crude"],
    ["us10y", "US 10Y", "Treasury Yield"],
] as const;

function quoteText(market?: MarketQuote) {
    if (!market || market.price == null) return "Data unavailable";
    return market.price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function pctText(market?: MarketQuote) {
    if (market?.change_percent == null) return "—";
    return `${market.change_percent >= 0 ? "+" : ""}${market.change_percent.toFixed(2)}%`;
}

export default function MacroView({ onPageChange }: Props) {
    const { data, error } = usePAL();
    const markets = data?.report?.macro?.markets ?? {};
    const [selected, setSelected] = useState("us500");
    const selectedMeta = MARKETS.find(([key]) => key === selected) ?? MARKETS[0];
    const market = markets[selected] as MarketQuote | undefined;
    const macro = data?.report?.macro;
    const news = useMemo(() => (macro?.news ?? []).slice(0, 5), [macro?.news]);

    return (
        <PalPageShell page="macro-view" onPageChange={onPageChange}>
            <div className="mx-auto max-w-7xl p-5 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Macro View</p>
                        <h1 className="mt-2 text-3xl font-semibold">{selectedMeta[1]}</h1>
                        <p className="mt-1 text-sm text-zinc-500">{selectedMeta[2]} · macro context, market mood and recent catalysts.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-right">
                        <p className="text-[10px] uppercase tracking-widest text-amber-300/70">Macro confidence</p>
                        <p className="mt-1 text-2xl font-semibold">{macro?.confidence ?? "—"}<span className="text-sm text-zinc-500">/100</span></p>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                    {MARKETS.map(([key, label]) => <button key={key} type="button" onClick={() => setSelected(key)} className={`rounded-full border px-3 py-1.5 text-xs transition ${selected === key ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-zinc-800 text-zinc-500 hover:text-zinc-200"}`}>{label}</button>)}
                </div>

                <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                        <div className="flex items-end justify-between gap-4">
                            <div><p className="text-xs uppercase tracking-widest text-zinc-600">Current value</p><p className="mt-2 text-4xl font-semibold tabular-nums">{quoteText(market)}</p></div>
                            <p className={`text-lg font-semibold ${market?.change_percent == null ? "text-zinc-500" : market.change_percent >= 0 ? "text-emerald-300" : "text-red-300"}`}>{pctText(market)}</p>
                        </div>
                        <div className="mt-7 flex min-h-48 items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900/40 p-6">
                            <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">Historical series</p><p className="mt-2 text-sm text-zinc-400">Waiting for OHLC/history from the online market provider.</p><p className="mt-2 text-xs text-zinc-600">PAL will not draw fabricated price history.</p></div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-600"><span>Provider status</span><span>{market?.status ?? "UNAVAILABLE"}</span></div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">AI overview</p><p className="mt-3 text-sm leading-6 text-zinc-300">{macro?.summary || "Macro summary is waiting for the PAL feed."}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Market policy</p><p className="mt-2 text-xl font-semibold">{macro?.gbpusd?.bias ?? "NEUTRAL"}</p><p className="mt-2 text-sm leading-6 text-zinc-500">{macro?.main_risk || "No additional macro risk supplied."}</p></div>
                    </div>
                </section>

                <section className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Flow</p><p className="mt-3 text-xl font-semibold">{market?.status ?? "UNAVAILABLE"}</p><p className="mt-2 text-sm text-zinc-500">Provider freshness state.</p></div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Bearing</p><p className="mt-3 text-xl font-semibold">{market?.change_percent == null ? "UNKNOWN" : market.change_percent >= 0 ? "UP" : "DOWN"}</p><p className="mt-2 text-sm text-zinc-500">Derived directly from the supplied market change.</p></div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Pulse</p><p className="mt-3 text-xl font-semibold">{error ? "DEGRADED" : "CONNECTED"}</p><p className="mt-2 text-sm text-zinc-500">Backend feed health, not a trading signal.</p></div>
                </section>

                <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent catalysts</h2><span className="text-xs uppercase tracking-widest text-zinc-600">Curated</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{news.map((item, index) => <div key={index} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4 text-sm leading-5 text-zinc-400">{String((item as any).title ?? (item as any).headline ?? "Macro headline")}</div>)}{!news.length && <p className="text-sm text-zinc-600">No macro headlines currently supplied.</p>}</div></section>
            </div>
        </PalPageShell>
    );
}
