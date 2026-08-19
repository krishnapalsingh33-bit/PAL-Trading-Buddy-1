import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

function clock(date: Date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function dateLabel(date: Date) {
    return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function normalizeBias(value: unknown) {
    const v = String(value ?? "").toUpperCase();
    if (v.includes("BULL")) return "BULLISH";
    if (v.includes("BEAR")) return "BEARISH";
    if (v.includes("NEUTRAL")) return "NEUTRAL";
    if (!v) return "UNKNOWN";
    return v;
}

function biasTone(bias: string) {
    if (bias === "BULLISH") return "text-emerald-300 border-emerald-300/20 bg-emerald-300/10";
    if (bias === "BEARISH") return "text-red-300 border-red-300/20 bg-red-300/10";
    if (bias === "NEUTRAL") return "text-amber-300 border-amber-300/20 bg-amber-300/10";
    return "text-zinc-400 border-zinc-700/60 bg-zinc-800/30";
}

function valueNumber(value: unknown, digits = 2) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }
    if (typeof value === "string" && value.trim()) return value;
    return "—";
}

function percent(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    if (typeof value === "string" && value.trim()) return value;
    return "—";
}

function quoteStatus(status: string | undefined) {
    const s = String(status ?? "UNAVAILABLE").toUpperCase();
    if (s === "CURRENT" || s === "LIVE") return "LIVE";
    if (s === "RECENT") return "RECENT";
    if (s === "STALE") return "STALE";
    return "UNAVAILABLE";
}

function findMarket(markets: Record<string, any> | undefined, keys: string[]) {
    if (!markets) return undefined;
    const entries = Object.entries(markets);
    for (const key of keys) {
        const exact = markets[key];
        if (exact) return exact;
        const found = entries.find(([name, item]) => String(name).toUpperCase() === key.toUpperCase() || String(item?.symbol ?? "").toUpperCase() === key.toUpperCase());
        if (found) return found[1];
    }
    return undefined;
}

function GlowLine({ tone = "cyan" }: { tone?: "cyan" | "green" | "amber" | "red" }) {
    const stroke = tone === "green" ? "#19e6a1" : tone === "amber" ? "#f7c948" : tone === "red" ? "#ff5f61" : "#19d9ff";
    return (
        <svg viewBox="0 0 180 54" className="absolute inset-x-0 bottom-0 h-14 w-full opacity-75" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id={`g-${tone}`} x1="0" x2="1">
                    <stop offset="0" stopColor={stroke} stopOpacity="0" />
                    <stop offset="0.5" stopColor={stroke} stopOpacity="0.65" />
                    <stop offset="1" stopColor={stroke} stopOpacity="0.1" />
                </linearGradient>
            </defs>
            <path d="M0 44 L14 41 L24 43 L35 31 L45 36 L57 29 L67 34 L79 24 L91 28 L104 18 L114 27 L128 15 L139 20 L151 11 L163 18 L180 8" fill="none" stroke={`url(#g-${tone})`} strokeWidth="1.4" className="pal-drift" />
        </svg>
    );
}

function LivePulse() {
    return <span className="relative inline-flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" /></span>;
}

function Session({ name, open }: { name: string; open: boolean }) {
    return (
        <div className="min-w-[88px] rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.08em] text-zinc-200"><span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" : "bg-zinc-700"}`} />{name}</div>
            <div className={`mt-0.5 text-[9px] font-semibold tracking-wider ${open ? "text-emerald-400" : "text-zinc-600"}`}>{open ? "OPEN" : "CLOSED"}</div>
        </div>
    );
}

function sessions(now: Date) {
    const h = now.getUTCHours() + now.getUTCMinutes() / 60;
    return {
        london: h >= 7 && h < 16,
        newYork: h >= 12 && h < 21,
        sydney: h >= 21 || h < 6,
        asia: h >= 0 && h < 9,
    };
}

function MarketCard({ label, quote, accent, digits = 2 }: { label: string; quote: any; accent: "cyan" | "green" | "amber" | "red"; digits?: number }) {
    const status = quoteStatus(quote?.status);
    const accentClass = accent === "green" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : accent === "red" ? "text-red-300" : "text-cyan-300";
    const lineTone = accent === "green" ? "green" : accent === "amber" ? "amber" : accent === "red" ? "red" : "cyan";
    const change = quote?.change_percent;
    const changeClass = typeof change === "number" ? (change >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-600";
    return (
        <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071019]/80 px-4 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-[#09131d]">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className={`text-[9px] font-semibold ${status === "LIVE" ? "text-emerald-300" : status === "RECENT" ? "text-amber-300" : "text-zinc-600"}`}>{status}</span>
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{valueNumber(quote?.price, digits)}</div>
            <div className={`mt-1 text-sm font-semibold ${changeClass}`}>{percent(change)}</div>
            <div className="mt-2 text-[8px] text-zinc-600">{quote?.source ?? "Provider unavailable"}{quote?.timestamp ? `  ·  ${new Date(quote.timestamp).toLocaleString()}` : ""}</div>
            <GlowLine tone={lineTone} />
            <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.045] blur-3xl ${accentClass}`} />
        </article>
    );
}

function StatusStrip({ label, bias }: { label: string; bias: string }) {
    return (
        <div className="flex items-center justify-between border-r border-white/[0.07] px-5 py-3 last:border-r-0">
            <div className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/5 text-[10px] text-cyan-300">◉</span><span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{label}</span></div>
            <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold ${biasTone(bias)}`}>{bias}</span>
        </div>
    );
}

function AppStyles() {
    return <style>{`@keyframes palDrift {0%{transform:translateX(-7px)}50%{transform:translateX(5px)}100%{transform:translateX(-7px)}} .pal-drift{animation:palDrift 7s ease-in-out infinite} @keyframes palFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-5px,0)}} .pal-float{animation:palFloat 5s ease-in-out infinite} @keyframes palScan{0%{transform:translateX(-100%);opacity:0}25%{opacity:.35}70%{opacity:.1}100%{transform:translateX(160%);opacity:0}} .pal-scan{animation:palScan 8s linear infinite} @keyframes palGlow{0%,100%{opacity:.25}50%{opacity:.55}} .pal-glow{animation:palGlow 4s ease-in-out infinite}`}</style>;
}

export default function Dashboard() {
    const { data, isLoading, isError } = usePAL();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const report = data?.report;
    const macro = report?.macro;
    const markets = macro?.markets;
    const session = useMemo(() => sessions(now), [now]);

    const dxy = findMarket(markets, ["DXY", "DX-Y.NYB"]);
    const gbpusd = findMarket(markets, ["GBPUSD", "GBP/USD"]);
    const gold = findMarket(markets, ["GOLD", "XAUUSD", "GC=F"]);
    const wti = findMarket(markets, ["WTI", "CL=F", "USOIL"]);
    const us10y = findMarket(markets, ["US10Y", "^TNX", "10Y"]);
    const us500 = findMarket(markets, ["US500", "^GSPC", "SPX"]);

    const dxyBias = normalizeBias(macro?.dxy?.bias);
    const gbpBias = normalizeBias(macro?.gbp?.bias);
    const pairBias = normalizeBias(macro?.gbpusd?.bias);
    const observations = [dxy, gbpusd, gold, wti, us10y, us500];
    const liveCount = observations.filter((q) => quoteStatus(q?.status) === "LIVE").length;
    const openSessions = Object.values(session).filter(Boolean).length;
    const integrity = isError ? "UNAVAILABLE" : liveCount > 0 ? "VERIFIED" : "CHECKING";

    const headline = macro?.headline || "Macro intelligence is waiting for current provider evidence.";
    const summary = macro?.summary || "No additional macro summary is available from the current provider response.";
    const reason = macro?.bias_summary || "No directional macro conclusion is available yet.";

    if (isLoading && !data) return <div className="min-h-screen bg-[#02070d]" />;

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#02070d] text-white selection:bg-cyan-300/20">
            <AppStyles />
            <div className="relative flex min-h-screen">
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-[120px] pal-glow" />
                    <div className="absolute right-0 top-32 h-[32rem] w-[32rem] rounded-full bg-emerald-400/[0.045] blur-[140px] pal-glow" />
                    <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-500/[0.035] blur-[120px]" />
                </div>

                <Sidebar symbol="GBPUSD" activePage="dashboard" />

                <main className="relative min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-[1540px]">
                        <section className="relative overflow-hidden rounded-[22px] border border-cyan-300/15 bg-[radial-gradient(circle_at_72%_18%,rgba(16,185,129,.12),transparent_28%),linear-gradient(135deg,#07141b,#061018_55%,#02090f)] shadow-[0_30px_100px_-55px_rgba(0,229,255,.55)]">
                            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(70,190,220,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(70,190,220,.07) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
                            <div className="pal-scan pointer-events-none absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent blur-xl" />
                            <div className="relative flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6">
                                <div className="flex items-center gap-4">
                                    <div className="pal-float flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.07] shadow-[0_0_30px_rgba(34,211,238,.16)]">
                                        <svg viewBox="0 0 48 48" className="h-9 w-9 text-cyan-300" fill="none"><path d="M7 34 17 23l7 6 12-17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M31 12h7v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="34" r="2" fill="currentColor"/><circle cx="17" cy="23" r="2" fill="currentColor"/><circle cx="24" cy="29" r="2" fill="currentColor"/></svg>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2.5"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">PAL Trading Buddy</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-bold tracking-wider text-emerald-300"><LivePulse /> LIVE</span></div>
                                        <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">Real market quotes + macro/news intelligence. No fabricated dashboard values.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Session name="LONDON" open={session.london} /><Session name="NEW YORK" open={session.newYork} /><Session name="SYDNEY" open={session.sydney} /><Session name="ASIA" open={session.asia} />
                                    <div className="min-w-[112px] rounded-xl border border-white/[0.07] bg-black/20 px-4 py-2.5 text-center"><div className="font-mono text-lg tracking-tight text-white">{clock(now)}</div><div className="text-[8px] tracking-[0.18em] text-zinc-600">{dateLabel(now)}</div></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 border-t border-white/[0.07] sm:grid-cols-3"><StatusStrip label="DXY" bias={dxyBias} /><StatusStrip label="GBP" bias={gbpBias} /><StatusStrip label="GBP/USD" bias={pairBias} /></div>
                        </section>

                        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#071019]/80 p-4"><div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">LIVE QUOTES</div><div className="mt-3 text-3xl font-semibold">{liveCount}/6</div><div className="mt-1 text-[10px] text-zinc-500">CURRENT PROVIDER OBSERVATIONS</div><GlowLine tone="green" /></div>
                            <div className="relative overflow-hidden rounded-2xl border border-blue-400/15 bg-[#071019]/80 p-4"><div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">SESSIONS</div><div className="mt-3 text-3xl font-semibold">{openSessions}</div><div className="mt-1 text-[10px] text-zinc-500">SESSIONS OPEN NOW</div><GlowLine tone="cyan" /></div>
                            <div className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-[#071019]/80 p-4"><div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">GBP/USD BIAS</div><div className={`mt-3 text-3xl font-semibold ${pairBias === "BULLISH" ? "text-emerald-300" : pairBias === "BEARISH" ? "text-red-300" : pairBias === "NEUTRAL" ? "text-amber-300" : "text-zinc-400"}`}>{pairBias}</div><div className="mt-1 text-[10px] text-zinc-500">FUNDAMENTAL NEWS MODEL</div><GlowLine tone="amber" /></div>
                            <div className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-[#071019]/80 p-4"><div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">DATA INTEGRITY</div><div className="mt-3 text-3xl font-semibold text-emerald-300">{integrity}</div><div className="mt-1 text-[10px] text-zinc-500">UNKNOWN STAYS UNKNOWN</div><GlowLine tone="green" /></div>
                        </section>

                        <section className="relative mt-4 overflow-hidden rounded-[22px] border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(8,22,28,.92),rgba(2,9,15,.95))] p-4 sm:p-5">
                            <div className="flex items-end justify-between"><div><div className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">MARKET DATA</div><h2 className="mt-1 text-xl font-semibold">Actual provider observations</h2><p className="mt-1 text-[10px] text-zinc-500">Prices and changes come directly from the backend market provider. If the provider cannot supply a current quote, PAL shows that state instead of guessing.</p></div><div className="flex items-center gap-2 text-[9px] text-zinc-500">REFRESH: 5S <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /></div></div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                                <MarketCard label="DXY" quote={dxy} accent="red" digits={3} />
                                <MarketCard label="GBP/USD" quote={gbpusd} accent="green" digits={4} />
                                <MarketCard label="Gold" quote={gold} accent="green" digits={2} />
                                <MarketCard label="WTI" quote={wti} accent="green" digits={2} />
                                <MarketCard label="US 10Y" quote={us10y} accent="green" digits={3} />
                                <MarketCard label="US500" quote={us500} accent="red" digits={2} />
                            </div>
                        </section>

                        <section className="relative mt-4 overflow-hidden rounded-[22px] border border-cyan-300/10 bg-[radial-gradient(circle_at_82%_50%,rgba(0,220,255,.08),transparent_28%),linear-gradient(135deg,#06151b,#031016)] p-4 sm:p-5">
                            <div className="absolute right-0 top-0 h-full w-[42%] opacity-70"><div className="absolute right-8 top-10 h-64 w-64 rounded-full border border-cyan-300/15 shadow-[0_0_80px_rgba(34,211,238,.12)] pal-float" /><div className="absolute right-20 top-22 h-44 w-44 rounded-full border border-emerald-300/10" /><div className="absolute right-4 top-24 h-56 w-56 rounded-full border border-cyan-300/10 [transform:rotate(28deg)]" /><div className="absolute right-24 top-28 h-40 w-40 rounded-full border border-cyan-300/10 [transform:rotate(-30deg)]" /><div className="absolute right-32 top-40 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,.9)] pal-glow" /></div>
                            <div className="relative z-10"><div className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">MACRO INTELLIGENCE</div><div className="mt-1 flex items-center gap-2"><h2 className="text-xl font-semibold">News-derived bias — evidence first</h2><span className="text-cyan-300">ⓘ</span></div><div className="mt-4 grid gap-3 lg:grid-cols-3">
                                {[
                                    ["DXY", dxyBias, macro?.dxy?.reasons?.[0] || "No explicit DXY macro evidence was returned by the current model."],
                                    ["GBP", gbpBias, macro?.gbp?.reasons?.[0] || "No explicit GBP macro evidence was returned by the current model."],
                                    ["GBP/USD", pairBias, macro?.gbpusd?.reasons?.[0] || reason],
                                ].map(([label, bias, text]) => <article key={String(label)} className="min-h-[150px] rounded-2xl border border-white/[0.08] bg-black/25 p-4 backdrop-blur-xl"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{label}</span><span className={`rounded-lg border px-2 py-1 text-[8px] font-bold ${biasTone(String(bias))}`}>{bias}</span></div><p className="mt-5 max-w-sm text-xs leading-5 text-zinc-400">{String(text)}</p></article>)}
                            </div></div>
                            <div className="relative z-10 mt-3 rounded-xl border border-cyan-300/10 bg-black/20 px-4 py-3 text-[10px] leading-5 text-zinc-400"><span className="mr-2 text-cyan-300">ⓘ</span><span>Important: </span><strong className="text-amber-300">NEUTRAL</strong><span> means the news model found balanced evidence. </span><strong className="text-zinc-300">UNKNOWN</strong><span> means the feed did not provide enough evidence to calculate a directional bias. The UI never converts UNKNOWN into fake NEUTRAL.</span></div>
                        </section>

                        <section className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                            <div className="rounded-[22px] border border-white/[0.07] bg-[#061018]/80 p-5"><div className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">CURRENT MACRO STORY</div><h2 className="mt-2 text-lg font-semibold">{headline}</h2><p className="mt-3 text-sm leading-6 text-zinc-400">{summary}</p></div>
                            <div className="rounded-[22px] border border-white/[0.07] bg-[#061018]/80 p-5"><div className="text-[10px] font-bold tracking-[0.2em] text-cyan-300">PROVIDER STATE</div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><div className="text-[8px] text-zinc-600">MARKET FEED</div><div className="mt-1 text-sm font-semibold text-white">{isError ? "UNAVAILABLE" : "CONNECTED"}</div></div><div className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><div className="text-[8px] text-zinc-600">MACRO CONFIDENCE</div><div className="mt-1 text-sm font-semibold text-white">{typeof macro?.confidence === "number" ? `${Math.round(macro.confidence)}%` : "—"}</div></div></div></div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
