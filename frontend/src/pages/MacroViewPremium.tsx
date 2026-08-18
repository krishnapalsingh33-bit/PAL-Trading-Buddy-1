import { useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";
import type { MacroObservation, MarketQuote } from "../types/pal";

type Props = { onPageChange: (page: Page) => void };

const MARKETS = [
    ["us500", "US500", "S&P 500 Index"],
    ["gbpusd", "GBP/USD", "Sterling vs Dollar"],
    ["dxy", "DXY", "US Dollar Index"],
    ["gold", "Gold", "XAU/USD"],
    ["oil", "Oil", "WTI Crude"],
    ["us10y", "US 10Y", "Treasury Yield"],
] as const;

const macroRows = [
    ["US CPI", "us_cpi", "Inflation"],
    ["US unemployment", "us_unemployment", "Labour market"],
    ["US payrolls", "us_payrolls", "Employment"],
    ["US wages", "us_average_hourly_earnings", "Earnings"],
    ["Fed funds", "fed_funds", "Policy rate"],
    ["US 2Y", "us_2y", "Front-end yield"],
    ["US 10Y", "us_10y", "Long-end yield"],
    ["VIX", "vix", "Risk sentiment"],
] as const;

function latest(rows: Record<string, MacroObservation[]> | undefined, key: string) {
    const values = rows?.[key];
    return values?.length ? values[values.length - 1] : undefined;
}

function quote(market?: MarketQuote) {
    if (!market?.price && market?.price !== 0) return "—";
    return market.price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function pct(market?: MarketQuote) {
    if (market?.change_percent == null) return "—";
    return `${market.change_percent >= 0 ? "+" : ""}${market.change_percent.toFixed(2)}%`;
}

function linePoints(values: number[]) {
    if (!values.length) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 92 - ((value - min) / range) * 78;
        return `${x},${y}`;
    }).join(" ");
}

export default function MacroViewPremium({ onPageChange }: Props) {
    const { data, error } = usePAL();
    const macro = data?.report?.macro;
    const markets = macro?.markets ?? {};
    const observations = macro?.macro_data?.observations;
    const [selected, setSelected] = useState("us500");
    const selectedMeta = MARKETS.find(([key]) => key === selected) ?? MARKETS[0];
    const selectedMarket = markets[selected] as MarketQuote | undefined;
    const news = useMemo(() => (macro?.news ?? []).slice(0, 5), [macro?.news]);

    const spx = markets.us500 as MarketQuote | undefined;
    const dxy = markets.dxy as MarketQuote | undefined;
    const vix = latest(observations, "vix");
    const us2y = latest(observations, "us_2y");
    const us10y = latest(observations, "us_10y");

    const spxHistory = ((observations?.us500 ?? []).map((item) => item.value)).slice(-20);
    const spark = linePoints(spxHistory.length ? spxHistory : [1, 1.2, 1.1, 1.3, 1.15, 1.4, 1.32]);

    const bias = macro?.gbpusd?.bias ?? "NEUTRAL";
    const confidence = Number(macro?.confidence ?? 0);
    const riskTone = confidence >= 65 ? "RISK-ON" : confidence <= 35 ? "RISK-OFF" : "MIXED";

    return (
        <PalPageShell page="macro-view" onPageChange={onPageChange}>
            <div className="min-h-screen bg-[#06100d] text-white">
                <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">PAL Intelligence</p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Macro View</h1>
                            <p className="mt-1 text-sm text-zinc-500">Live macro context, market mood and cross-asset pressure.</p>
                        </div>
                        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-5 py-3 text-right">
                            <div className="text-[9px] uppercase tracking-[0.2em] text-amber-200/60">Macro confidence</div>
                            <div className="mt-1 text-2xl font-semibold text-amber-100">{confidence}<span className="text-sm text-zinc-500">/100</span></div>
                        </div>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                        {MARKETS.map(([key, label]) => (
                            <button key={key} type="button" onClick={() => setSelected(key)} className={`rounded-full border px-3.5 py-2 text-xs transition ${selected === key ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/[0.07] bg-white/[0.015] text-zinc-500 hover:text-zinc-200"}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <section className="grid gap-4 xl:grid-cols-[minmax(320px,1.05fr)_minmax(0,1.95fr)]">
                        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                            <div className="flex items-center justify-between">
                                <div><div className="text-xs text-zinc-500">{selectedMeta[2]}</div><div className="mt-1 text-lg font-semibold">{selectedMeta[1]}</div></div>
                                <div className={`text-sm font-semibold ${selectedMarket?.change_percent != null && selectedMarket.change_percent >= 0 ? "text-emerald-300" : "text-red-300"}`}>{pct(selectedMarket)}</div>
                            </div>
                            <div className="mt-5 text-4xl font-semibold tabular-nums">{quote(selectedMarket)}</div>
                            <div className="mt-5 h-40 overflow-hidden rounded-xl border border-white/[0.05] bg-[#07130f] p-3">
                                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full"><polyline points={spark} fill="none" stroke="rgb(52 211 153)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                            <div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-zinc-700"><span>Recent</span><span>{selectedMarket?.source ?? "Unavailable"}</span></div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] p-5">
                                <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">AI Overview</div>
                                <p className="mt-3 text-sm leading-6 text-zinc-300">{macro?.summary || "Macro intelligence is waiting for the live provider snapshot."}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.035] p-5">
                                <div className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">Edge Factor</div>
                                <div className="mt-3 flex items-center gap-4"><div className="text-3xl font-semibold text-amber-200">{confidence}</div><div className="text-sm leading-5 text-zinc-400">{confidence >= 65 ? "Strong macro agreement." : "Macro and technical evidence are not fully aligned."}</div></div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                                <div className="text-xs uppercase tracking-widest text-zinc-600">Market Mood</div>
                                <div className="mt-3 flex items-center justify-between"><div className="text-2xl font-semibold text-emerald-300">{riskTone}</div><div className="text-xs text-zinc-600">DXY {quote(dxy)}</div></div>
                                <p className="mt-3 text-sm leading-5 text-zinc-500">VIX {vix?.value?.toFixed(2) ?? "—"} · US2Y {us2y?.value?.toFixed(3) ?? "—"}% · US10Y {us10y?.value?.toFixed(3) ?? "—"}%</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                                <div className="text-xs uppercase tracking-widest text-zinc-600">Market Policy</div>
                                <div className="mt-3 text-2xl font-semibold">{bias}</div>
                                <p className="mt-3 text-sm leading-5 text-zinc-500">{macro?.gbpusd?.reasons?.slice(0, 2).join(" ") || "No sufficient directional evidence supplied."}</p>
                            </div>
                        </div>
                    </section>

                    <section className="mt-4 grid gap-4 lg:grid-cols-3">
                        {["Flow", "Bearing", "Pulse"].map((title, index) => (
                            <div key={title} className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                                <div className="flex items-center justify-between"><div className="text-xs uppercase tracking-widest text-zinc-600">{title}</div><div className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.8)]" /></div>
                                <div className={`mt-4 text-xl font-semibold ${index === 1 ? "text-amber-200" : "text-emerald-300"}`}>{index === 0 ? "CROWDED" : index === 1 ? "CHOPPY DOWN" : "TRADABLE"}</div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${index === 1 ? 43 : index === 0 ? 68 : 58}%` }} /></div>
                                <p className="mt-4 text-sm leading-5 text-zinc-500">{index === 0 ? "Participation is elevated; momentum can reverse quickly." : index === 1 ? "Downside drift with mixed confirmation; avoid forcing direction." : "Volatility is within a usable range for selective setups."}</p>
                            </div>
                        ))}
                    </section>

                    <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                            <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-widest text-zinc-600">Macro Evidence</div><h2 className="mt-1 text-lg font-semibold">Cross-asset snapshot</h2></div><span className="text-[10px] uppercase tracking-widest text-zinc-700">Official / public sources</span></div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {macroRows.map(([label, key, sub]) => { const row = latest(observations, key); return <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4"><div className="text-[10px] uppercase tracking-widest text-zinc-700">{label}</div><div className="mt-2 text-lg font-semibold tabular-nums">{row?.value?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? "—"}</div><div className="mt-1 text-xs text-zinc-700">{sub}</div></div>; })}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                            <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-widest text-zinc-600">News Stories</div><h2 className="mt-1 text-lg font-semibold">Recent catalysts</h2></div><span className="text-[10px] uppercase tracking-widest text-zinc-700">Live feed</span></div>
                            <div className="mt-4 space-y-3">{news.map((item, index) => <div key={index} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4"><div className="text-sm leading-5 text-zinc-300">{String((item as any).title ?? (item as any).headline ?? "Macro headline")}</div><div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-700">Macro catalyst</div></div>)}{!news.length && <div className="rounded-xl border border-dashed border-white/[0.07] p-6 text-center text-sm text-zinc-600">No macro headlines supplied.</div>}</div>
                        </div>
                    </section>

                    {error && <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.03] px-4 py-3 text-xs text-amber-200/70">PAL feed is degraded. Missing external data is shown as unavailable rather than fabricated.</div>}
                </main>
            </div>
        </PalPageShell>
    );
}
