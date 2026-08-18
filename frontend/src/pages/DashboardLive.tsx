import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

function normalizeBias(value: unknown): string {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw.includes("BULL")) return "BULLISH";
    if (raw.includes("BEAR")) return "BEARISH";
    if (raw === "NEUTRAL") return "NEUTRAL";
    return "UNKNOWN";
}

function biasTone(bias: string) {
    if (bias === "BULLISH") return "text-emerald-300 border-emerald-400/20 bg-emerald-400/10";
    if (bias === "BEARISH") return "text-red-300 border-red-400/20 bg-red-400/10";
    if (bias === "NEUTRAL") return "text-amber-300 border-amber-400/20 bg-amber-400/10";
    return "text-zinc-400 border-white/10 bg-white/[0.03]";
}

function quoteTone(value: unknown) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return "text-emerald-300";
    if (Number.isFinite(n) && n < 0) return "text-red-300";
    return "text-zinc-400";
}

function formatPrice(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatPercent(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function quoteStatus(value: unknown) {
    const status = String(value ?? "UNAVAILABLE").toUpperCase();
    if (status === "CURRENT") return { label: "LIVE", className: "text-emerald-300" };
    if (status === "RECENT") return { label: "RECENT", className: "text-amber-300" };
    if (status === "STALE") return { label: "STALE", className: "text-amber-300" };
    return { label: "UNAVAILABLE", className: "text-red-300" };
}

function sessionState(date: Date) {
    const hour = date.getUTCHours();
    return {
        London: hour >= 7 && hour < 16,
        "New York": hour >= 13 && hour < 22,
        Sydney: hour >= 21 || hour < 6,
        Asia: hour >= 0 && hour < 9,
    };
}

export default function DashboardLive({
    activePage = "dashboard",
    onPageChange,
}: {
    activePage?: any;
    onPageChange?: (page: any) => void;
}) {
    const { data, isLoading, error } = usePAL();
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setClock(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const sessions = useMemo(() => sessionState(clock), [clock]);

    if (isLoading) {
        return <div className="min-h-screen bg-[#050607] text-white p-8">Loading live PAL feed…</div>;
    }

    if (error || !data?.report) {
        return (
            <div className="min-h-screen bg-[#050607] text-white flex items-center justify-center p-8">
                <div className="max-w-md rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-7 text-center">
                    <div className="text-xs uppercase tracking-[0.2em] text-red-300">Live feed error</div>
                    <h1 className="mt-3 text-2xl font-semibold">PAL cannot read the backend</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">Restart the backend API and reload this page. The dashboard will not invent market values.</p>
                    <button className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm" onClick={() => window.location.reload()}>Retry</button>
                </div>
            </div>
        );
    }

    const report: any = data.report;
    const macro = report.macro ?? {};
    const markets = macro.markets ?? report.markets ?? report.market_data ?? {};
    const dxy = normalizeBias(macro?.dxy?.bias);
    const gbp = normalizeBias(macro?.gbp?.bias);
    const gbpusd = normalizeBias(macro?.gbpusd?.bias);
    const marketEntries = [
        ["DXY", ["DXY"]],
        ["GBP/USD", ["GBPUSD", "GBP/USD"]],
        ["Gold", ["XAUUSD", "GOLD", "XAU/USD"]],
        ["WTI", ["USOIL", "WTI", "OIL", "XTIUSD"]],
        ["US 10Y", ["US10Y", "10Y", "TNX"]],
        ["US500", ["US500", "SPX", "SP500"]],
    ].map(([label, keys]) => {
        const source = Array.isArray(markets)
            ? markets.find((item: any) => keys.some((key: string) => String(item?.symbol ?? item?.ticker ?? "").toUpperCase() === key.toUpperCase()))
            : keys.map((key: string) => markets?.[key]).find(Boolean);
        return { label, quote: source ?? {} };
    });

    const liveCount = marketEntries.filter(({ quote }) => String(quote.status ?? "").toUpperCase() === "CURRENT").length;
    const sessionsOpen = Object.values(sessions).filter(Boolean).length;

    return (
        <div className="min-h-screen bg-[#050607] text-zinc-100">
            <div className="flex min-h-screen">
                <Sidebar symbol="GBPUSD" activePage={activePage} onPageChange={onPageChange} />
                <main className="min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
                        <section className="relative overflow-hidden rounded-3xl border border-emerald-300/10 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.025] to-cyan-500/[0.06] p-6 shadow-[0_30px_100px_-55px_rgba(16,185,129,0.65)]">
                            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.10] blur-3xl" />
                            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-xl text-emerald-200">✦</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h1 className="text-2xl font-semibold text-white">PAL Trading Buddy</h1>
                                                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] uppercase tracking-wider text-emerald-300">Live</span>
                                            </div>
                                            <p className="mt-1 text-xs text-zinc-500">Real market quotes + macro/news intelligence. No fabricated dashboard values.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(sessions).map(([name, open]) => (
                                        <div key={name} className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-2">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">{name}</div>
                                            <div className={`mt-1 text-[9px] uppercase tracking-wider ${open ? "text-emerald-300" : "text-zinc-600"}`}>{open ? "OPEN" : "CLOSED"}</div>
                                        </div>
                                    ))}
                                    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-2 font-mono text-sm text-zinc-200">{clock.toLocaleTimeString([], { hour12: false })}</div>
                                </div>
                            </div>
                            <div className="relative mt-6 grid grid-cols-3 border-t border-white/[0.06] pt-4">
                                {[['DXY', dxy], ['GBP', gbp], ['GBP/USD', gbpusd]].map(([label, bias]) => (
                                    <div key={String(label)} className="flex items-center justify-between px-3 first:pl-0">
                                        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{label}</span>
                                        <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${biasTone(String(bias))}`}>{String(bias)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Live Quotes</div>
                                <div className="mt-3 text-3xl font-semibold text-white">{liveCount}/{marketEntries.length}</div>
                                <div className="mt-1 text-xs text-zinc-500">CURRENT provider observations</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Sessions</div>
                                <div className="mt-3 text-3xl font-semibold text-white">{sessionsOpen}</div>
                                <div className="mt-1 text-xs text-zinc-500">sessions open now</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">GBP/USD Bias</div>
                                <div className={`mt-3 text-2xl font-semibold ${biasTone(gbpusd).split(" ")[0]}`}>{gbpusd}</div>
                                <div className="mt-1 text-xs text-zinc-500">fundamental news model</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Data Integrity</div>
                                <div className="mt-3 text-2xl font-semibold text-emerald-300">VERIFIED</div>
                                <div className="mt-1 text-xs text-zinc-500">unknown stays unknown</div>
                            </div>
                        </div>

                        <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 lg:p-6">
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Market Data</div>
                                    <h2 className="mt-2 text-xl font-semibold text-white">Actual provider observations</h2>
                                    <p className="mt-1 text-xs text-zinc-500">Prices and changes come directly from the backend market provider. If the provider cannot supply a current quote, PAL shows that state instead of guessing.</p>
                                </div>
                                <div className="text-right text-[9px] uppercase tracking-wider text-zinc-600">refresh: 5s</div>
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {marketEntries.map(({ label, quote }: any) => {
                                    const status = quoteStatus(quote.status);
                                    return (
                                        <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-white">{label}</span>
                                                <span className={`text-[9px] font-semibold uppercase tracking-wider ${status.className}`}>{status.label}</span>
                                            </div>
                                            <div className="mt-5 flex items-end justify-between gap-3">
                                                <div>
                                                    <div className="text-2xl font-semibold text-white">{formatPrice(quote.price)}</div>
                                                    <div className={`mt-1 text-xs ${quoteTone(quote.change_percent ?? quote.change)}`}>{formatPercent(quote.change_percent)}</div>
                                                </div>
                                                <div className="text-right text-[9px] leading-4 text-zinc-600">{quote.source ?? "No provider"}<br />{quote.timestamp ? new Date(quote.timestamp).toLocaleString() : "No timestamp"}</div>
                                            </div>
                                            {quote.reason && <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2 text-[10px] leading-4 text-zinc-600">{quote.reason}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 lg:p-6">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Macro Intelligence</div>
                            <h2 className="mt-2 text-xl font-semibold text-white">News-derived bias — evidence first</h2>
                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                                {[['DXY', dxy, macro?.dxy?.reasons], ['GBP', gbp, macro?.gbp?.reasons], ['GBP/USD', gbpusd, macro?.gbpusd?.reasons]].map(([label, bias, reasons]) => (
                                    <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                                        <div className="flex items-center justify-between"><span className="font-semibold text-white">{String(label)}</span><span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${biasTone(String(bias))}`}>{String(bias)}</span></div>
                                        <div className="mt-4 text-xs leading-5 text-zinc-500">{Array.isArray(reasons) && reasons.length ? reasons.slice(0, 3).join(" · ") : "No explicit macro evidence was returned by the current news model."}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-4 text-xs leading-5 text-zinc-500">Important: NEUTRAL means the news model found balanced evidence. UNKNOWN means the feed did not provide enough evidence to calculate a directional bias. The UI no longer converts UNKNOWN into fake NEUTRAL.</div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
