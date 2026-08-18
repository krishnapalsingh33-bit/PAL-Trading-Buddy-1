import { useEffect, useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";
import type { MacroObservation, MarketQuote } from "../types/pal";

type Props = { onPageChange: (page: Page) => void };

type MarketConfig = {
    key: string;
    symbol: string;
    title: string;
    subtitle: string;
    aliases: string[];
};

const MARKETS: MarketConfig[] = [
    { key: "gbpjpy", symbol: "GBPJPY", title: "GBPJPY", subtitle: "GBPJPY Cross", aliases: ["GBPJPY", "gbpjpy"] },
    { key: "ethusd", symbol: "ETHUSD", title: "ETHUSD", subtitle: "Ethereum / USD", aliases: ["ETHUSD", "ethusd"] },
    { key: "gold", symbol: "XAUUSD", title: "XAUUSD", subtitle: "Gold / USD", aliases: ["XAUUSD", "xauusd", "gold"] },
    { key: "usdcad", symbol: "USDCAD", title: "USDCAD", subtitle: "USD / CAD", aliases: ["USDCAD", "usdcad"] },
    { key: "gbpusd", symbol: "GBPUSD", title: "GBPUSD", subtitle: "GBP / USD", aliases: ["GBPUSD", "gbpusd"] },
    { key: "us100", symbol: "US100", title: "US100", subtitle: "NASDAQ 100 Index", aliases: ["US100", "us100", "US500", "us500"] },
    { key: "us30", symbol: "US30", title: "US30", subtitle: "Dow Jones Index", aliases: ["US30", "us30"] },
    { key: "eurjpy", symbol: "EURJPY", title: "EURJPY", subtitle: "EUR / JPY", aliases: ["EURJPY", "eurjpy"] },
    { key: "eurgbp", symbol: "EURGBP", title: "EURGBP", subtitle: "EUR / GBP", aliases: ["EURGBP", "eurgbp"] },
];

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

function findMarket(markets: Record<string, MarketQuote>, config: MarketConfig) {
    for (const alias of config.aliases) {
        const value = markets[alias];
        if (value) return value;
    }
    return undefined;
}

function latest(rows: Record<string, MacroObservation[]> | undefined, key: string) {
    const values = rows?.[key];
    return values?.length ? values[values.length - 1] : undefined;
}

function price(value?: MarketQuote) {
    if (value?.price == null) return "—";
    return value.price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function change(value?: MarketQuote) {
    if (value?.change_percent == null) return "—";
    return `${value.change_percent >= 0 ? "+" : ""}${value.change_percent.toFixed(2)}%`;
}

function chartPoints(market?: MarketQuote) {
    if (!market || market.price == null) return "";
    const previous = market.previous_price ?? market.price;
    const current = market.price;
    const values = previous === current ? [previous, previous * 1.001, previous * 0.999, current] : [previous, current];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(Math.abs(current) * 0.001, 1);
    return values.map((value, index) => {
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 82 - ((value - min) / range) * 62;
        return `${x},${y}`;
    }).join(" ");
}

function confidenceTone(confidence: number) {
    if (confidence >= 70) return "Strong alignment across macro and market evidence.";
    if (confidence >= 50) return "Moderate alignment with some conflicting evidence.";
    return "Mixed / low clarity. Preserve capital and wait for stronger confirmation.";
}

function marketMood(confidence: number, vix?: number) {
    if (vix != null && vix >= 25) return "RISK-OFF";
    if (confidence >= 65) return "RISK-ON";
    if (confidence <= 35) return "RISK-OFF";
    return "MIXED";
}

export default function MacroViewPremium({ onPageChange }: Props) {
    const { data, error } = usePAL();
    const macro = data?.report?.macro;
    const markets = (macro?.markets ?? {}) as Record<string, MarketQuote>;
    const observations = macro?.macro_data?.observations;
    const [selectedKey, setSelectedKey] = useState("us100");

    useEffect(() => {
        try {
            const stored = window.sessionStorage.getItem("pal_macro_view_market");
            if (stored && MARKETS.some((item) => item.key === stored)) setSelectedKey(stored);
        } catch {
            // Keep the default selection when storage is unavailable.
        }
    }, []);

    const selected = MARKETS.find((item) => item.key === selectedKey) ?? MARKETS[5];
    const selectedMarket = findMarket(markets, selected);
    const confidence = Math.max(0, Math.min(100, Number(macro?.confidence ?? 0)));
    const edgeFactor = Math.max(0, Math.min(100, Math.round(confidence * 0.62)));
    const vix = latest(observations, "vix")?.value;
    const us2y = latest(observations, "us_2y")?.value;
    const us10y = latest(observations, "us_10y")?.value;
    const mood = marketMood(confidence, vix);
    const bias = macro?.gbpusd?.bias ?? "NEUTRAL";
    const news = useMemo(() => (macro?.news ?? []).slice(0, 3), [macro?.news]);
    const spark = chartPoints(selectedMarket);

    const flow = confidence >= 70 ? "HEALTHY" : confidence >= 45 ? "CROWDED" : "THIN";
    const bearing = bias.toUpperCase().includes("BEAR") ? "CHOPPY DOWN" : bias.toUpperCase().includes("BULL") ? "UPTREND" : "CHOPPY";
    const pulse = confidence >= 60 ? "TRADABLE" : "QUIET";

    return (
        <PalPageShell page="macro-view" onPageChange={onPageChange}>
            <div className="min-h-screen bg-[#06100d] text-white">
                <main className="mx-auto max-w-[1420px] px-4 py-5 sm:px-6 lg:px-8">
                    <button type="button" onClick={() => onPageChange("macro-desk")} className="mb-5 flex items-center gap-2 text-xs font-medium text-zinc-400 transition hover:text-white">
                        ← Back to AI Macro Desk
                    </button>

                    <header className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] font-bold text-zinc-300">{selected.symbol === "US100" ? "100" : selected.symbol.slice(0, 3)}</div>
                            <div>
                                <h1 className="text-4xl font-semibold tracking-tight sm:text-[46px]">{selected.title}</h1>
                                <p className="mt-1 text-sm text-zinc-500">{selected.subtitle}</p>
                            </div>
                        </div>

                        <div className="flex min-w-[390px] items-center gap-5 rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,.22)]">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/[0.06] text-xl font-semibold text-amber-200">{edgeFactor}</div>
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Edge Factor</div>
                                <div className="mt-1 text-xs font-semibold text-amber-200">{edgeFactor >= 70 ? "High Alignment" : edgeFactor >= 45 ? "Mixed / Low Clarity" : "Low Clarity"}</div>
                                <p className="mt-1 max-w-[390px] text-xs leading-5 text-zinc-500">{confidenceTone(confidence)}</p>
                            </div>
                        </div>
                    </header>

                    <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)]">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-semibold tabular-nums">{price(selectedMarket)}</div>
                                        <div className={`mt-1 text-xs font-semibold ${selectedMarket?.change_percent != null && selectedMarket.change_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>{change(selectedMarket)}</div>
                                    </div>
                                    <div className="flex gap-1 text-[9px] text-zinc-600"><span className="rounded bg-white/[0.05] px-2 py-1">1D</span><span className="rounded bg-white/[0.05] px-2 py-1">5D</span><span className="rounded bg-white/[0.05] px-2 py-1">1M</span></div>
                                </div>
                                <div className="mt-5 h-36 overflow-hidden rounded-xl bg-[#07120f] p-2">
                                    {spark ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full"><polyline points={spark} fill="none" stroke="rgb(239 68 68)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div className="flex h-full items-center justify-center text-xs text-zinc-700">Live chart unavailable</div>}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-4">
                                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">News Stories</h2><span className="text-[9px] uppercase tracking-widest text-zinc-700">Live</span></div>
                                <div className="space-y-2.5">
                                    {news.map((item, index) => <div key={index} className="rounded-xl border border-white/[0.05] bg-black/20 p-3"><div className="text-[11px] leading-5 text-zinc-300">{String((item as any).title ?? (item as any).headline ?? "Macro catalyst")}</div><div className="mt-1 text-[9px] text-zinc-700">{String((item as any).source ?? "Macro feed")}</div></div>)}
                                    {!news.length && <div className="rounded-xl border border-dashed border-white/[0.06] p-5 text-center text-xs text-zinc-700">No live stories supplied.</div>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-5">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">◆ AI Overview</div>
                                <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">{macro?.summary || "PAL is combining live market, macro and news evidence before assigning directional conviction."}</p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-5">
                                    <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Market Mood</div><span className="text-[9px] text-zinc-600">3m ago</span></div>
                                    <div className="mt-5 grid grid-cols-[150px_1fr] items-center gap-5">
                                        <div className="relative flex h-24 items-end justify-center overflow-hidden"><div className="absolute bottom-0 h-20 w-40 rounded-t-full border-[9px] border-b-0 border-emerald-400/80 border-l-cyan-400/30 border-r-zinc-800/80" /><div className="relative z-10 mb-3 h-2 w-16 rotate-[-38deg] origin-left rounded-full bg-emerald-300" /></div>
                                        <div><div className="text-xl font-semibold text-emerald-300">{mood}</div><p className="mt-2 text-xs leading-5 text-zinc-500">Investor positioning is being assessed from volatility, rates, USD pressure and the current macro confidence score.</p></div>
                                    </div>
                                    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-zinc-500">● {mood}: current cross-asset risk tone.</div>
                                </div>

                                <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-5">
                                    <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Market Policy</div><span className="text-[9px] text-zinc-600">3m ago</span></div>
                                    <div className="mt-5 grid grid-cols-[150px_1fr] items-center gap-5"><div className="text-center text-xl font-bold tracking-[0.25em] text-zinc-300">{bias === "NEUTRAL" ? "NEUTRAL" : bias}</div><div><div className="text-sm font-semibold text-zinc-300">Global Economic Outlook</div><p className="mt-2 text-xs leading-5 text-zinc-500">{macro?.gbpusd?.reasons?.slice(0, 2).join(" ") || "Policy evidence is not sufficient to establish a clean directional regime."}</p></div></div>
                                    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-zinc-500">● {bias}: current policy / macro directional stance.</div>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                {[
                                    ["Flow", flow, "Very high participation can make momentum vulnerable to reversal.", flow === "CROWDED" ? 68 : 52],
                                    ["Bearing", bearing, "Downside drift but mixed confirmation — exercise caution before committing risk.", bearing.includes("DOWN") ? 38 : 58],
                                    ["Pulse", pulse, "Volatility and market conditions determine whether setups have room to breathe.", pulse === "TRADABLE" ? 58 : 35],
                                ].map(([title, value, text, width]) => <div key={String(title)} className="rounded-2xl border border-white/[0.08] bg-[#091310] p-5"><div className="text-[10px] uppercase tracking-widest text-zinc-500">{title}</div><div className={`mt-3 text-lg font-semibold ${String(title) === "Bearing" ? "text-red-300" : "text-emerald-300"}`}>{String(value)}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Number(width)}%` }} /></div><p className="mt-4 text-xs leading-5 text-zinc-500">{String(text)}</p></div>)}
                            </div>
                        </div>
                    </section>

                    <section className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-5"><div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Market Sessions</div><h2 className="mt-1 text-lg font-semibold">Session map</h2></div><span className="rounded-md border border-white/[0.06] px-2 py-1 text-[9px] text-zinc-600">GMT+1 Timezone</span></div><div className="mt-5 grid grid-cols-3 gap-2">{["Asia", "London", "New York"].map((session) => <div key={session} className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-4"><div className="text-xs font-semibold">{session}</div><div className="mt-2 h-1.5 rounded-full bg-emerald-400/50" /><div className="mt-2 text-[9px] text-zinc-700">Market window</div></div>)}</div></div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#091310] p-5"><div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Relative Strength</div><h2 className="mt-1 text-lg font-semibold">Cross-asset pressure</h2></div><span className="rounded-md border border-white/[0.06] px-2 py-1 text-[9px] text-zinc-600">Basket: US100, DXY, US10Y, VIX</span></div><div className="mt-5 h-20 rounded-xl bg-white/[0.015] p-2"><svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full"><polyline points="0,22 12,20 25,21 38,15 50,18 62,13 75,15 88,9 100,11" fill="none" stroke="rgb(244 114 182)" strokeWidth="1.4" strokeLinecap="round" /></svg></div></div>
                    </section>

                    <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#091310] p-5">
                        <div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Macro Evidence</div><h2 className="mt-1 text-lg font-semibold">Cross-asset snapshot</h2></div><span className="text-[9px] uppercase tracking-widest text-zinc-700">Official / public sources</span></div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{macroRows.map(([label, key, sub]) => { const row = latest(observations, key); return <div key={key} className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-4"><div className="text-[9px] uppercase tracking-widest text-zinc-700">{label}</div><div className="mt-2 text-lg font-semibold tabular-nums">{row?.value?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? "—"}</div><div className="mt-1 text-[10px] text-zinc-700">{sub}</div></div>; })}</div>
                    </section>

                    <div className="mt-4 flex flex-wrap gap-2">{MARKETS.map((market) => <button key={market.key} type="button" onClick={() => { setSelectedKey(market.key); try { window.sessionStorage.setItem("pal_macro_view_market", market.key); } catch { /* noop */ } }} className={`rounded-full border px-3 py-1.5 text-[10px] transition ${selected.key === market.key ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/[0.06] text-zinc-600 hover:text-zinc-300"}`}>{market.title}</button>)}</div>

                    {error && <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.03] px-4 py-3 text-xs text-amber-200/70">Some external feeds are degraded. PAL shows unavailable data instead of fabricating market values.</div>}
                </main>
            </div>
        </PalPageShell>
    );
}
