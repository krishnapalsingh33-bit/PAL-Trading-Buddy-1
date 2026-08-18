import { useMemo } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";
import type { MarketQuote } from "../types/pal";

type Props = { onPageChange: (page: Page) => void };

const MARKET_META: Record<string, { label: string; subtitle: string }> = {
    dxy: { label: "DXY", subtitle: "US Dollar Index" },
    gbpusd: { label: "GBP/USD", subtitle: "Sterling vs Dollar" },
    gold: { label: "Gold", subtitle: "XAU/USD" },
    oil: { label: "Oil", subtitle: "WTI / Crude" },
    us10y: { label: "US 10Y", subtitle: "Treasury Yield" },
    us500: { label: "US500", subtitle: "US Equity Index" },
};

function formatPrice(market: MarketQuote | undefined) {
    if (!market || market.price == null) return "Data unavailable";
    return market.price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function formatPercent(market: MarketQuote | undefined) {
    if (!market || market.change_percent == null) return "—";
    const value = market.change_percent;
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function freshness(market: MarketQuote | undefined) {
    if (!market) return "Unavailable";
    if (market.status === "CURRENT" && market.freshness_seconds != null) {
        return market.freshness_seconds < 60
            ? `Updated ${Math.max(1, Math.round(market.freshness_seconds))}s ago`
            : `Updated ${Math.round(market.freshness_seconds / 60)}m ago`;
    }
    return market.status === "STALE" ? "STALE · last known data" : market.status;
}

function biasFor(key: string, report: any) {
    if (key === "dxy") return report?.dxy?.bias ?? "NEUTRAL";
    if (key === "gbpusd") return report?.gbpusd?.bias ?? "NEUTRAL";
    return "NEUTRAL";
}

export default function MacroDesk({ onPageChange }: Props) {
    const { data, isLoading, error } = usePAL();
    const report = data?.report?.macro;
    const markets = report?.markets ?? {};
    const cards = useMemo(() => Object.keys(MARKET_META), []);
    const headlines = (report?.news ?? []).slice(0, 4);
    const sourceStatus = report?.macro_data?.source_status ?? {};

    return (
        <PalPageShell page="macro-desk" onPageChange={onPageChange}>
            <div className="mx-auto max-w-7xl p-5 sm:p-8">
                <header className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">AI Macro Desk</p>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">Markets That Matter</h1>
                            <p className="mt-2 max-w-2xl text-sm text-zinc-500">Cross-asset market intelligence connected to PAL's live market, macro-data and news feeds.</p>
                        </div>
                        <div className="rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300">LIVE MACRO FEED</div>
                    </div>
                </header>

                <section className="mb-6 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-widest text-zinc-500">Overall GBP/USD bias</p><p className="mt-2 text-xl font-semibold">{report?.gbpusd?.bias ?? "—"}</p></div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-widest text-zinc-500">Macro confidence</p><p className="mt-2 text-xl font-semibold">{report?.confidence ?? "—"}<span className="text-sm text-zinc-500"> / 100</span></p></div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-widest text-zinc-500">Feed status</p><p className="mt-2 text-xl font-semibold">{error ? "DEGRADED" : isLoading ? "LOADING" : "CONNECTED"}</p></div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {cards.map((key) => {
                        const market = markets[key] as MarketQuote | undefined;
                        const meta = MARKET_META[key];
                        const change = market?.change_percent ?? null;
                        const bias = biasFor(key, report);
                        return (
                            <article key={key} className="group rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20 transition hover:border-emerald-400/20">
                                <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{meta.label}</h2><p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-600">{meta.subtitle}</p></div><span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{bias}</span></div>
                                <div className="mt-6 flex items-end justify-between gap-3"><div><div className="text-3xl font-semibold tabular-nums tracking-tight">{formatPrice(market)}</div><div className={`mt-1 text-sm font-medium ${change == null ? "text-zinc-500" : change >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatPercent(market)}</div></div><div className="text-right text-[11px] text-zinc-600">{freshness(market)}</div></div>
                                <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-1/3 rounded-full bg-emerald-400/60 transition-all group-hover:w-2/3" /></div>
                                <p className="mt-4 text-xs leading-5 text-zinc-500">{market?.reason || "Live market data supplied by the macro feed."}</p>
                            </article>
                        );
                    })}
                </section>

                <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-emerald-300/70">News intelligence</p><h2 className="mt-1 text-lg font-semibold">Recent macro catalysts</h2></div><span className="text-xs text-zinc-600">{headlines.length} shown</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{headlines.map((item, index) => <div key={index} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4"><p className="text-sm leading-5 text-zinc-300">{String((item as any).title ?? (item as any).headline ?? "Macro headline")}</p><p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-600">{String((item as any).source ?? "Provider")}</p></div>)}{!headlines.length && <p className="text-sm text-zinc-600">No macro headlines currently supplied.</p>}</div></div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-widest text-cyan-300/70">Data health</p><div className="mt-4 space-y-2">{Object.entries(sourceStatus).map(([source, status]) => <div key={source} className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-900/40 px-3 py-2"><span className="text-xs text-zinc-500">{source}</span><span className="text-[10px] uppercase tracking-wider text-zinc-400">{status}</span></div>)}{!Object.keys(sourceStatus).length && <p className="text-sm text-zinc-600">No macro observation sources reported.</p>}</div><p className="mt-4 text-xs leading-5 text-zinc-600">Provider failures remain isolated; PAL shows unavailable data rather than inventing values.</p></div>
                </section>

                <p className="mt-5 text-xs text-zinc-600">Prices, changes, freshness and macro observations are displayed only when supplied by backend providers. No values are invented by the UI.</p>
            </div>
        </PalPageShell>
    );
}
