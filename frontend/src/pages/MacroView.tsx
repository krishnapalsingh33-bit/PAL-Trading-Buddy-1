import { useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";
import type { MarketQuote, MacroObservation } from "../types/pal";

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

function latest(observations: Record<string, MacroObservation[]> | undefined, key: string) {
    const rows = observations?.[key];
    return rows?.length ? rows[rows.length - 1] : undefined;
}

function previous(observations: Record<string, MacroObservation[]> | undefined, key: string) {
    const rows = observations?.[key];
    return rows && rows.length > 1 ? rows[rows.length - 2] : undefined;
}

function observationChange(observations: Record<string, MacroObservation[]> | undefined, key: string) {
    const current = latest(observations, key)?.value;
    const prior = previous(observations, key)?.value;
    if (current == null || prior == null || prior === 0) return null;
    return ((current - prior) / Math.abs(prior)) * 100;
}

export default function MacroView({ onPageChange }: Props) {
    const { data, error } = usePAL();
    const markets = data?.report?.macro?.markets ?? {};
    const macro = data?.report?.macro;
    const macroData = macro?.macro_data;
    const [selected, setSelected] = useState("us500");
    const selectedMeta = MARKETS.find(([key]) => key === selected) ?? MARKETS[0];
    const market = markets[selected] as MarketQuote | undefined;
    const news = useMemo(() => (macro?.news ?? []).slice(0, 6), [macro?.news]);

    const observations = macroData?.observations;
    const macroRows = [
        ["US CPI", "us_cpi", "US inflation"],
        ["US unemployment", "us_unemployment", "Labour market"],
        ["US payrolls", "us_payrolls", "Employment"],
        ["US wages", "us_average_hourly_earnings", "Average hourly earnings"],
        ["UK CPIH", "uk_cpih", "UK inflation"],
        ["Fed funds", "fed_funds", "Policy rate"],
        ["US 2Y", "us_2y", "Front-end yield"],
        ["US 10Y", "us_10y", "Long-end yield"],
        ["VIX", "vix", "Risk sentiment"],
    ] as const;

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
                        <div className="mt-7 rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
                            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">Macro evidence</p><span className="text-[10px] uppercase tracking-widest text-zinc-600">Official/public sources</span></div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {macroRows.map(([label, key, subtitle]) => {
                                    const current = latest(observations, key);
                                    const delta = observationChange(observations, key);
                                    return <div key={key} className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-4"><p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{current ? current.value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "Unavailable"}</p><p className="mt-1 text-xs text-zinc-600">{subtitle}{delta == null ? "" : ` · ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% vs prior observation`}</p></div>;
                                })}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-600"><span>Market provider</span><span>{market?.source ?? "UNAVAILABLE"} · {market?.status ?? "UNAVAILABLE"}</span></div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">PAL overview</p><p className="mt-3 text-sm leading-6 text-zinc-300">{macro?.summary || "Macro summary is waiting for the PAL feed."}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Directional evidence</p><p className="mt-2 text-xl font-semibold">{macro?.gbpusd?.bias ?? "NEUTRAL"}</p><p className="mt-2 text-sm leading-6 text-zinc-500">{macro?.gbpusd?.reasons?.slice(0, 3).join(" ") || "No sufficient directional evidence supplied."}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-zinc-600">Data sources</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(macroData?.source_status ?? {}).map(([source, status]) => <span key={source} className="rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">{source}: {status}</span>)}</div>{!macroData && <p className="mt-3 text-sm text-zinc-600">No macro observation snapshot supplied.</p>}</div>
                    </div>
                </section>

                <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent catalysts</h2><span className="text-xs uppercase tracking-widest text-zinc-600">Curated</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{news.map((item, index) => <div key={index} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4 text-sm leading-5 text-zinc-400">{String((item as any).title ?? (item as any).headline ?? "Macro headline")}</div>)}{!news.length && <p className="text-sm text-zinc-600">No macro headlines currently supplied.</p>}</div></section>

                {error && <p className="mt-4 text-xs text-amber-300/70">PAL feed is degraded. Missing external data is shown as unavailable rather than fabricated.</p>}
            </div>
        </PalPageShell>
    );
}
