import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";


type NewsItem = {
    title?: string;
    time?: string;
    minutes?: number;
};


function formatClock(date: Date) {
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}


function formatDate(date: Date) {
    return date.toLocaleDateString([], {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}


function normalizeBias(value: unknown) {
    const bias = String(value ?? "").toUpperCase();

    if (bias.includes("BULL")) {
        return "BULLISH";
    }

    if (bias.includes("BEAR")) {
        return "BEARISH";
    }

    return "NEUTRAL";
}


function biasClasses(bias: string) {
    if (bias === "BULLISH") {
        return {
            text: "text-emerald-300",
            soft: "bg-emerald-400/10",
            border: "border-emerald-400/20",
            dot: "bg-emerald-400",
        };
    }

    if (bias === "BEARISH") {
        return {
            text: "text-red-300",
            soft: "bg-red-400/10",
            border: "border-red-400/20",
            dot: "bg-red-400",
        };
    }

    return {
        text: "text-zinc-300",
        soft: "bg-zinc-400/10",
        border: "border-zinc-400/20",
        dot: "bg-zinc-400",
    };
}


const STRATEGY_LANGUAGE = /\b(?:cisd|fvg|fair value gap|displacement|liquidity sweep|liquidity sweeps|liquidity|manipulation|premium\s*\/\s*discount|premium-discount|delivery|trade allowed|ready for entry|entry model|execution model|execution setup|workflow stage|wait[_ -]?(?:structure|liquidity|manipulation|displacement|delivery|cisd|fvg|premium|discount))\b/i;

function macroOnlyText(
    value: unknown,
    fallback: string,
) {
    const text = String(value ?? "").trim();

    if (!text || STRATEGY_LANGUAGE.test(text)) {
        return fallback;
    }

    return text;
}


function Panel({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`relative overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-transparent shadow-[0_30px_90px_-55px_rgba(0,0,0,0.98)] backdrop-blur-2xl ${className}`}
        >
            {children}
        </section>
    );
}


function SectionHeading({
    eyebrow,
    title,
    description,
}: {
    eyebrow: string;
    title: string;
    description?: string;
}) {
    return (
        <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                {eyebrow}
            </div>

            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
                {title}
            </h2>

            {description ? (
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {description}
                </p>
            ) : null}
        </div>
    );
}


function SessionPill({
    name,
    status,
}: {
    name: string;
    status: string;
}) {
    const active = status === "OPEN";

    return (
        <div className="flex min-w-[118px] items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    active
                        ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                        : "bg-zinc-700"
                }`}
            />

            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                    {name}
                </div>

                <div
                    className={`text-[9px] uppercase tracking-wider ${
                        active
                            ? "text-emerald-400"
                            : "text-zinc-600"
                    }`}
                >
                    {status}
                </div>
            </div>
        </div>
    );
}




function GlowDot({
    tone = "emerald",
}: {
    tone?: "emerald" | "red" | "amber" | "cyan";
}) {
    const classes = {
        emerald:
            "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]",
        red:
            "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.85)]",
        amber:
            "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.75)]",
        cyan:
            "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.75)]",
    };

    return (
        <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${classes[tone]}`}
        />
    );
}



function DecorativeGrid() {
    return (
        <div className="pointer-events-none absolute inset-0 opacity-40">
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
                    backgroundSize: "38px 38px",
                    maskImage:
                        "linear-gradient(to bottom, black, transparent 78%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black, transparent 78%)",
                }}
            />
        </div>
    );
}


function ProbabilityRing({
    value,
    tone,
}: {
    value: number;
    tone: "emerald" | "red" | "neutral";
}) {
    const stroke =
        tone === "emerald"
            ? "#34d399"
            : tone === "red"
              ? "#f87171"
              : "#71717a";

    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    const dash = Math.max(
        0,
        Math.min(100, value),
    );

    return (
        <div className="relative h-16 w-16 shrink-0">
            <svg
                viewBox="0 0 64 64"
                className="-rotate-90 h-16 w-16"
            >
                <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="5"
                />

                <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(dash / 100) * circumference} ${circumference}`}
                />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">
                    {Math.round(value)}%
                </span>
            </div>
        </div>
    );
}


function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[#050607] text-white">
            <div className="flex min-h-screen">
                <div className="hidden w-20 border-r border-white/[0.06] bg-black/20 lg:block" />

                <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-9">
                    <div className="mx-auto max-w-[1500px] animate-pulse">
                        <div className="h-24 rounded-2xl bg-white/[0.035]" />

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-20 rounded-xl bg-white/[0.03]"
                                />
                            ))}
                        </div>

                        <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
                            <div className="h-[430px] rounded-2xl bg-white/[0.03]" />
                            <div className="h-[430px] rounded-2xl bg-white/[0.03]" />
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <div className="h-64 rounded-2xl bg-white/[0.03]" />
                            <div className="h-64 rounded-2xl bg-white/[0.03]" />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}




type MacroMarketFeed = {
    symbol?: string;
    label?: string;
    price?: number | string | null;
    change?: number | string | null;
    change_pct?: number | string | null;
    percent_change?: number | string | null;
    bias?: string | null;
    confidence?: number | null;
    reason?: string | null;
    status?: string | null;
};

function readMacroMarket(
    source: any,
    keys: string[],
): MacroMarketFeed {
    if (!source) {
        return {};
    }

    if (Array.isArray(source)) {
        const match = source.find((item) => {
            const value = String(
                item?.symbol ?? item?.ticker ?? item?.label ?? "",
            ).toUpperCase();

            return keys.some((key) =>
                value === key.toUpperCase(),
            );
        });

        return match ?? {};
    }

    for (const key of keys) {
        const direct = source?.[key];

        if (direct && typeof direct === "object") {
            return direct;
        }
    }

    return {};
}

function displayMarketNumber(
    value: unknown,
    digits = 2,
) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return "—";
}

function displayMarketChange(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        const sign = value > 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}%`;
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return "—";
}

function MacroDeskCard({
    label,
    subtitle,
    market,
    fallbackBias = "NEUTRAL",
    accent = "cyan",
}: {
    label: string;
    subtitle: string;
    market: MacroMarketFeed;
    fallbackBias?: string;
    accent?: "emerald" | "red" | "amber" | "cyan";
}) {
    const bias = normalizeBias(
        market.bias ?? fallbackBias,
    );

    const change =
        market.change_pct ?? market.percent_change ?? market.change;

    const hasPrice =
        market.price !== undefined &&
        market.price !== null &&
        String(market.price).trim() !== "";

    const hasChange =
        change !== undefined &&
        change !== null &&
        String(change).trim() !== "";

    const palette = {
        emerald: {
            glow: "bg-emerald-400",
            soft: "bg-emerald-400/[0.07]",
            border: "border-emerald-400/10",
            text: "text-emerald-300",
        },
        red: {
            glow: "bg-red-400",
            soft: "bg-red-400/[0.07]",
            border: "border-red-400/10",
            text: "text-red-300",
        },
        amber: {
            glow: "bg-amber-300",
            soft: "bg-amber-300/[0.07]",
            border: "border-amber-300/10",
            text: "text-amber-300",
        },
        cyan: {
            glow: "bg-cyan-300",
            soft: "bg-cyan-300/[0.07]",
            border: "border-cyan-300/10",
            text: "text-cyan-300",
        },
    }[accent];

    const biasTone = biasClasses(bias);

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.045] via-white/[0.02] to-black/20 p-4 shadow-inner shadow-white/[0.02] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13]">
            <div
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${palette.glow} opacity-10 blur-3xl transition duration-300 group-hover:opacity-20`}
            />

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${palette.glow} shadow-[0_0_12px_currentColor]`}
                        />
                        <span className="text-sm font-semibold tracking-tight text-white">
                            {label}
                        </span>
                    </div>

                    <div className="mt-1 truncate text-[9px] uppercase tracking-[0.15em] text-zinc-600">
                        {subtitle}
                    </div>
                </div>

                <span
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.13em] ${biasTone.border} ${biasTone.soft} ${biasTone.text}`}
                >
                    {bias}
                </span>
            </div>

            <div className="relative mt-5 flex items-end justify-between gap-3">
                <div>
                    <div className="text-xl font-semibold tracking-tight text-white">
                        {hasChange
    ? displayMarketChange(change)
    : "Fundamental macro bias"}
                    </div>

                    <div
                        className={`mt-1 text-[10px] font-medium ${
                            hasChange
                                ? changeValueClass(change)
                                : bias === "BULLISH"
                                  ? "text-emerald-300"
                                  : bias === "BEARISH"
                                    ? "text-red-300"
                                    : "text-zinc-500"
                        }`}
                    >
                        {hasChange
                            ? displayMarketChange(change)
                            : `${bias} fundamental bias`}
                    </div>
                </div>

                <div className="text-right">
                    {typeof market.confidence === "number" ? (
                        <>
                            <div className="text-[9px] uppercase tracking-[0.13em] text-zinc-700">
                                Confidence
                            </div>
                            <div className={`mt-1 text-sm font-semibold ${palette.text}`}>
                                {Math.round(market.confidence)}%
                            </div>
                        </>
                    ) : (
                        <div className="text-[9px] uppercase tracking-[0.13em] text-zinc-500">
                            Macro bias
                        </div>
                    )}
                </div>
            </div>

            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                    className={`h-full rounded-full ${palette.glow} opacity-60`}
                    style={{
                        width: `${
                            typeof market.confidence === "number"
                                ? Math.min(Math.max(market.confidence, 6), 100)
                                : bias === "NEUTRAL"
                                  ? 18
                                  : 38
                        }%`,
                    }}
                />
            </div>

            <div className="relative mt-3 min-h-[36px] text-[10px] leading-5 text-zinc-600">
                {macroOnlyText(
                    market.reason,
                    hasPrice
                        ? "Live market data supplied by the macro feed."
                        : "Fundamental direction supplied by PAL macro intelligence. Live price data is not currently connected.",
                )}
            </div>
        </div>
    );
}

function changeValueClass(value: unknown) {
    const numeric =
        typeof value === "number"
            ? value
            : Number.parseFloat(String(value));

    if (Number.isFinite(numeric)) {
        if (numeric > 0) return "text-emerald-300";
        if (numeric < 0) return "text-red-300";
    }

    return "text-zinc-400";
}


function Dashboard({
    activePage = "dashboard",
    onPageChange,
}: {
    activePage?: "dashboard" | "journal";
    onPageChange?: (nextPage: "dashboard" | "journal") => void;
}) {
    const { data, isLoading, error } = usePAL();

    const [clock, setClock] = useState(
        () => new Date(),
    );

    useEffect(() => {
        const timer = window.setInterval(() => {
            setClock(new Date());
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    const sessionStatus = useMemo(() => {
        const hour = clock.getUTCHours();

        return {
            london:
                hour >= 7 && hour < 16
                    ? "OPEN"
                    : "CLOSED",
            newYork:
                hour >= 13 && hour < 22
                    ? "OPEN"
                    : "CLOSED",
            asia:
                hour >= 0 && hour < 9
                    ? "OPEN"
                    : "CLOSED",
            sydney:
                hour >= 21 || hour < 6
                    ? "OPEN"
                    : "CLOSED",
        };
    }, [clock]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#050607] p-6 text-white">
                <Panel className="w-full max-w-md p-8 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
                        Connection
                    </div>

                    <h1 className="mt-3 text-2xl font-semibold">
                        Market data unavailable
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                        PAL could not load the current market
                        report. Check that the backend is running.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            window.location.reload()
                        }
                        className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
                    >
                        Retry
                    </button>
                </Panel>
            </div>
        );
    }

    if (!data || !data.report) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#050607] p-6 text-white">
                <Panel className="w-full max-w-md p-8 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                        Market Intelligence
                    </div>

                    <h1 className="mt-3 text-2xl font-semibold">
                        No briefing available
                    </h1>

                    <p className="mt-2 text-sm text-zinc-500">
                        The dashboard is ready, but the current
                        market feed has not returned a report yet.
                    </p>
                </Panel>
            </div>
        );
    }

    const report = data.report as any;

    const symbol =
        String(data.symbol ?? "GBP/USD");

    // ==========================================================
    // MACRO DATA
    // ==========================================================

    const macro =
        report.macro ?? {};

    // ==========================================================
    // MACRO BIAS
    // ==========================================================
    // The backend exposes the current fundamental bias under
    // report.macro. Keep legacy fallbacks for compatibility.

    const dxyBias = normalizeBias(
        macro?.dxy?.bias ??
            report.dxy?.trend ??
            report.summary?.dxy?.trend,
    );

    const gbpBias = normalizeBias(
        macro?.gbp?.bias,
    );

    const gbpUsdBias = normalizeBias(
        macro?.gbpusd?.bias ??
            report.pal?.overall_bias,
    );

    const marketHealth =
        String(
            report.market_health?.status ??
                report.summary?.market?.health ??
                "UNKNOWN",
        ).toUpperCase();

    const newsSummary =
        String(
            report.news?.summary ??
                "No high-impact news summary available.",
        );

    const newsWarnings = Array.isArray(
        report.news?.warnings,
    )
        ? report.news.warnings
        : [];

    const highImpact: NewsItem[] =
        Array.isArray(report.news?.high_impact)
            ? report.news.high_impact
            : [];

    const marketFeed =
        macro?.markets ??
        macro?.market_data ??
        report?.markets ??
        report?.market_data ??
        {};

    const macroDesk = [
        {
            label: "DXY",
            subtitle: "US dollar index",
            keys: ["DXY"],
            fallbackBias: dxyBias,
            accent: dxyBias === "BEARISH" ? "red" : "cyan",
        },
        {
            label: "GBP/USD",
            subtitle: "Sterling vs dollar",
            keys: ["GBPUSD", "GBP/USD"],
            fallbackBias: gbpUsdBias,
            accent: gbpUsdBias === "BULLISH" ? "emerald" : "red",
        },
        {
            label: "Gold",
            subtitle: "XAU/USD",
            keys: ["XAUUSD", "GOLD", "XAU/USD"],
            fallbackBias: "NEUTRAL",
            accent: "amber",
        },
        {
            label: "Oil",
            subtitle: "WTI / crude",
            keys: ["USOIL", "WTI", "OIL", "XTIUSD"],
            fallbackBias: "NEUTRAL",
            accent: "amber",
        },
        {
            label: "US 10Y",
            subtitle: "Treasury yield",
            keys: ["US10Y", "10Y", "TNX"],
            fallbackBias: "NEUTRAL",
            accent: "cyan",
        },
        {
            label: "US500",
            subtitle: "US equity index",
            keys: ["US500", "SPX", "SP500"],
            fallbackBias: "NEUTRAL",
            accent: "emerald",
        },
    ].map((item) => ({
        ...item,
        market: readMacroMarket(marketFeed, item.keys),
    }));

    const hasMacroProbabilities =
        typeof macro?.dxy?.bullish === "number" ||
        typeof macro?.gbp?.bullish === "number" ||
        typeof macro?.gbpusd?.bullish === "number";

    const briefingSummary = macroOnlyText(
        macro?.summary ?? macro?.description,
        "The latest fundamental market picture is being monitored by PAL.",
    );

    const briefingHeadline = macroOnlyText(
        macro?.headline,
        "The market picture, distilled into clarity.",
    );

    const mainRisk = macroOnlyText(
        macro?.main_risk ?? newsWarnings[0],
        "No major market risk flag supplied by the current feed.",
    );

    const macroEvents: NewsItem[] =
        Array.isArray(macro?.events)
            ? macro.events
            : highImpact;

    const confidence =
        typeof macro?.confidence === "number"
            ? macro.confidence
            : null;

    const probabilityCards = [
        {
            label: "DXY",
            bullish:
                typeof macro?.dxy?.bullish ===
                "number"
                    ? macro.dxy.bullish
                    : null,
            bearish:
                typeof macro?.dxy?.bearish ===
                "number"
                    ? macro.dxy.bearish
                    : null,
            bias: dxyBias,
        },
        {
            label: "GBP",
            bullish:
                typeof macro?.gbp?.bullish ===
                "number"
                    ? macro.gbp.bullish
                    : null,
            bearish:
                typeof macro?.gbp?.bearish ===
                "number"
                    ? macro.gbp.bearish
                    : null,
            bias: normalizeBias(
                macro?.gbp?.bias ??
                    report.pal?.overall_bias,
            ),
        },
        {
            label: "GBP/USD",
            bullish:
                typeof macro?.gbpusd?.bullish ===
                "number"
                    ? macro.gbpusd.bullish
                    : null,
            bearish:
                typeof macro?.gbpusd?.bearish ===
                "number"
                    ? macro.gbpusd.bearish
                    : null,
            bias: gbpUsdBias,
        },
    ];

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#050607] text-zinc-100">
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute left-1/2 top-[-22rem] h-[42rem] w-[68rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.045] blur-3xl" />
                <div className="absolute right-[-14rem] top-1/3 h-[32rem] w-[32rem] rounded-full bg-cyan-500/[0.035] blur-3xl" />
                <div className="absolute bottom-[-16rem] left-[-12rem] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.03] blur-3xl" />
            </div>

            <div className="flex min-h-screen">
                <Sidebar
                    symbol={symbol}
                    activePage={activePage}
                    onPageChange={onPageChange}
                />

                <main className="min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                        {/* TOP COMMAND BAR */}
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-300/[0.10] bg-gradient-to-r from-emerald-500/[0.10] via-white/[0.035] to-cyan-400/[0.055] shadow-[0_35px_100px_-65px_rgba(16,185,129,0.65)] backdrop-blur-2xl">
                            <DecorativeGrid />

                            <div className="relative flex flex-col gap-5 p-5 lg:p-6 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 shadow-[0_0_30px_-10px_rgba(52,211,153,0.75)]">
                                        <div className="absolute inset-2 rounded-xl border border-emerald-300/10" />
                                        <span className="relative text-xl text-emerald-200">
                                            ✦
                                        </span>
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-white">
                                                PAL Trading Buddy
                                            </h1>

                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                                <GlowDot />
                                                Live
                                            </span>
                                        </div>

                                        <p className="mt-1 text-xs text-zinc-500">
                                            Global macro intelligence · important information, without the noise.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-stretch gap-2">
                                    <SessionPill
                                        name="London"
                                        status={
                                            sessionStatus.london
                                        }
                                    />

                                    <SessionPill
                                        name="New York"
                                        status={
                                            sessionStatus.newYork
                                        }
                                    />

                                    <SessionPill
                                        name="Sydney"
                                        status={
                                            sessionStatus.sydney
                                        }
                                    />

                                    <SessionPill
                                        name="Asia"
                                        status={
                                            sessionStatus.asia
                                        }
                                    />

                                    <div className="min-w-[112px] rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-right shadow-inner shadow-white/[0.02]">
                                        <div className="font-mono text-sm font-medium tracking-tight text-zinc-200">
                                            {formatClock(
                                                clock,
                                            )}
                                        </div>

                                        <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-zinc-600">
                                            Local time
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative grid grid-cols-3 border-t border-white/[0.06] bg-black/10">
                                {[
                                    ["DXY", dxyBias],
                                    ["GBP", gbpBias],
                                    ["GBP/USD", gbpUsdBias],
                                ].map(([label, bias], index) => {
                                    const tone =
                                        bias === "BULLISH"
                                            ? "emerald"
                                            : bias === "BEARISH"
                                              ? "red"
                                              : "amber";

                                    return (
                                        <div
                                            key={label}
                                            className={`flex items-center justify-between gap-3 px-4 py-3 sm:px-6 ${
                                                index > 0
                                                    ? "border-l border-white/[0.06]"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <GlowDot
                                                    tone={
                                                        tone as any
                                                    }
                                                />
                                                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                                    {label}
                                                </span>
                                            </div>

                                            <span
                                                className={`text-[10px] font-semibold ${
                                                    biasClasses(
                                                        bias,
                                                    ).text
                                                }`}
                                            >
                                                {bias}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* MARKET SNAPSHOT */}
                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <Panel className="group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/[0.14]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                            Primary Market
                                        </div>

                                        <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            {symbol}
                                        </div>

                                        <div className="mt-1 text-[10px] text-zinc-600">
                                            Current focus
                                        </div>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-500">
                                        ↗
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                                    <GlowDot tone="cyan" />
                                    Live feed
                                </div>
                            </Panel>

                            <Panel className="group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/[0.14]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                            GBP/USD
                                        </div>

                                        <div
                                            className={`mt-3 text-2xl font-semibold tracking-[-0.03em] ${
                                                biasClasses(
                                                    gbpUsdBias,
                                                ).text
                                            }`}
                                        >
                                            {gbpUsdBias}
                                        </div>

                                        <div className="mt-1 text-[10px] text-zinc-600">
                                            Fundamental direction
                                        </div>
                                    </div>

                                    {typeof macro?.gbpusd?.bullish ===
                                    "number" ? (
                                        <ProbabilityRing
                                            value={
                                                macro.gbpusd
                                                    .bullish
                                            }
                                            tone={
                                                gbpUsdBias ===
                                                "BULLISH"
                                                    ? "emerald"
                                                    : gbpUsdBias ===
                                                        "BEARISH"
                                                      ? "red"
                                                      : "neutral"
                                            }
                                        />
                                    ) : (
                                        <div className="flex h-10 items-center rounded-xl border border-white/[0.07] bg-black/20 px-3 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                                            Probability pending
                                        </div>
                                    )}
                                </div>
                            </Panel>

                            <Panel className="group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.14]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                            Dollar
                                        </div>

                                        <div
                                            className={`mt-3 text-2xl font-semibold tracking-[-0.03em] ${
                                                biasClasses(
                                                    dxyBias,
                                                ).text
                                            }`}
                                        >
                                            {dxyBias}
                                        </div>

                                        <div className="mt-1 text-[10px] text-zinc-600">
                                            DXY direction
                                        </div>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/10 bg-red-300/[0.04]">
                                        <GlowDot
                                            tone={
                                                dxyBias ===
                                                "BEARISH"
                                                    ? "red"
                                                    : "cyan"
                                            }
                                        />
                                    </div>
                                </div>
                            </Panel>

                            <Panel className="group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/[0.14]">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                                            Market Condition
                                        </div>

                                        <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            {marketHealth}
                                        </div>

                                        <div className="mt-1 text-[10px] text-zinc-600">
                                            Current feed status
                                        </div>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/10 bg-amber-300/[0.04] text-amber-300">
                                        ◌
                                    </div>
                                </div>
                            </Panel>
                        </div>

                        {/* AI MACRO DESK */}
                        <div className="mt-5">
                            <Panel className="overflow-hidden border-cyan-300/[0.08]">
                                <div className="relative border-b border-white/[0.06] px-5 py-4 sm:px-6">
                                    <div className="pointer-events-none absolute right-0 top-0 h-28 w-72 bg-cyan-400/[0.035] blur-3xl" />

                                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <SectionHeading
                                            eyebrow="AI Macro Desk"
                                            title="Markets That Matter"
                                            description="A compact cross-asset view of the forces that can shape GBP/USD."
                                        />

                                        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-zinc-700">
                                            <GlowDot tone="cyan" />
                                            Live feed architecture
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {macroDesk.map((item) => (
                                        <MacroDeskCard
                                            key={item.label}
                                            label={item.label}
                                            subtitle={item.subtitle}
                                            market={item.market}
                                            fallbackBias={item.fallbackBias}
                                            accent={item.accent as "emerald" | "red" | "amber" | "cyan"}
                                        />
                                    ))}
                                </div>

                                <div className="border-t border-white/[0.06] bg-black/10 px-5 py-3 text-[10px] leading-5 text-zinc-700 sm:px-6">
                                    Prices, changes and confidence are shown only when supplied by the macro market feed. No values are invented by the Dashboard.
                                </div>
                            </Panel>
                        </div>

                        {/* HERO */}
                        <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
                            <Panel className="overflow-hidden border-emerald-300/[0.10]">
                                <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-emerald-400/[0.06] blur-3xl" />
                                <div className="relative border-b border-white/[0.06] px-5 py-4 sm:px-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <SectionHeading
                                            eyebrow="For You"
                                            title="Market Briefing"
                                            description="The important part of the current market picture — without the noise."
                                        />

                                        <div className="hidden rounded-lg border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[9px] uppercase tracking-wider text-zinc-600 sm:block">
                                            {formatDate(
                                                clock,
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.35fr_0.8fr]">
                                    <div>
                                        <div
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                                                biasClasses(
                                                    gbpUsdBias,
                                                ).border
                                            } ${
                                                biasClasses(
                                                    gbpUsdBias,
                                                ).soft
                                            } ${
                                                biasClasses(
                                                    gbpUsdBias,
                                                ).text
                                            }`}
                                        >
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${
                                                    biasClasses(
                                                        gbpUsdBias,
                                                    ).dot
                                                }`}
                                            />
                                            GBP/USD{" "}
                                            {gbpUsdBias}
                                        </div>

                                        <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-white sm:text-4xl">
                                            {briefingHeadline}
                                        </h2>

                                        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                                            {briefingSummary}
                                        </p>

                                        <div className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.045] p-4">
                                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                                                <span>⚠</span>
                                                Main Risk
                                            </div>

                                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                                {mainRisk}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                                            Macro Confidence
                                        </div>

                                        {confidence !== null ? (
                                            <>
                                                <div className="mt-4 flex items-end justify-between">
                                                    <div className="text-4xl font-semibold tracking-tight text-white">
                                                        {
                                                            confidence
                                                        }
                                                    </div>

                                                    <div className="pb-1 text-xs text-zinc-600">
                                                        / 100
                                                    </div>
                                                </div>

                                                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.28)]"
                                                        style={{
                                                            width: `${Math.min(
                                                                Math.max(
                                                                    confidence,
                                                                    0,
                                                                ),
                                                                100,
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mt-5 rounded-xl border border-dashed border-white/[0.07] p-4">
                                                <div className="text-sm font-medium text-zinc-300">
                                                    Awaiting macro feed
                                                </div>

                                                <div className="mt-1 text-xs leading-5 text-zinc-600">
                                                    Fundamental probability data will appear here when supplied by the macro briefing service.
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-5 border-t border-white/[0.06] pt-4">
                                            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                                                Data status
                                            </div>

                                            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                Connected to PAL feed
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Panel>

                            <Panel className="p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <SectionHeading
                                        eyebrow="Market View"
                                        title="Bias Monitor"
                                        description="Fundamental directional context from the current market feed."
                                    />

                                    {hasMacroProbabilities ? (
                                        <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-2 py-1 text-[9px] uppercase tracking-wider text-emerald-300">
                                            Macro
                                        </span>
                                    ) : (
                                        <span className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1 text-[9px] uppercase tracking-wider text-zinc-600">
                                            Feed
                                        </span>
                                    )}
                                </div>

                                <div className="mt-6 space-y-3">
                                    {probabilityCards.map(
                                        (item) => (
                                            <div
                                                key={
                                                    item.label
                                                }
                                                className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-black/20 p-4 shadow-inner shadow-white/[0.02]"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-sm font-semibold text-white">
                                                            {
                                                                item.label
                                                            }
                                                        </div>

                                                        <div
                                                            className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${
                                                                biasClasses(
                                                                    item.bias,
                                                                ).text
                                                            }`}
                                                        >
                                                            {
                                                                item.bias
                                                            }
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        {item.bullish !==
                                                            null &&
                                                        item.bearish !==
                                                            null ? (
                                                            <>
                                                                <div className="text-sm font-semibold text-zinc-200">
                                                                    {
                                                                        item.bullish
                                                                    }
                                                                    %
                                                                    <span className="px-1 text-zinc-700">
                                                                        /
                                                                    </span>
                                                                    {
                                                                        item.bearish
                                                                    }
                                                                    %
                                                                </div>

                                                                <div className="text-[9px] uppercase tracking-wider text-zinc-600">
                                                                    Bull / Bear
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-[10px] uppercase tracking-wider text-zinc-700">
                                                                Probability
                                                                pending
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {item.bullish !==
                                                    null &&
                                                item.bearish !==
                                                    null ? (
                                                    <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
                                                        <div
                                                            className="bg-emerald-400"
                                                            style={{
                                                                width: `${item.bullish}%`,
                                                            }}
                                                        />

                                                        <div
                                                            className="bg-red-400"
                                                            style={{
                                                                width: `${item.bearish}%`,
                                                            }}
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        ),
                                    )}
                                </div>
                            </Panel>
                        </div>

                        {/* EVENTS + MACRO PULSE */}
                        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                            <Panel className="p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <SectionHeading
                                        eyebrow="Important Events"
                                        title="What Matters Next"
                                        description="Only high-impact items supplied by the market feed."
                                    />

                                    <span className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-zinc-600">
                                        {
                                            macroEvents.length
                                        }{" "}
                                        items
                                    </span>
                                </div>

                                {macroEvents.length === 0 ? (
                                    <div className="mt-5 rounded-xl border border-dashed border-white/[0.07] bg-black/10 p-5 text-center">
                                        <div className="text-sm text-zinc-400">
                                            No high-impact events currently supplied.
                                        </div>

                                        <div className="mt-1 text-xs text-zinc-600">
                                            {newsSummary}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-5 space-y-2">
                                        {macroEvents
                                            .slice(0, 5)
                                            .map(
                                                (
                                                    event,
                                                    index,
                                                ) => (
                                                    <div
                                                        key={`${event.title ?? "event"}-${index}`}
                                                        className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/20 p-4"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-400/10 text-red-300">
                                                                <span className="text-xs">
                                                                    !
                                                                </span>
                                                            </div>

                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium text-zinc-200">
                                                                    {
                                                                        event.title
                                                                    }
                                                                </div>

                                                                <div className="mt-1 text-[10px] text-zinc-600">
                                                                    {event.time
                                                                        ? String(
                                                                              event.time,
                                                                          )
                                                                        : "Time not supplied"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="shrink-0 text-right">
                                                            {typeof event.minutes ===
                                                            "number" ? (
                                                                <div className="text-xs font-semibold text-amber-300">
                                                                    {
                                                                        event.minutes
                                                                    }
                                                                    m
                                                                </div>
                                                            ) : (
                                                                <div className="text-[9px] uppercase tracking-wider text-zinc-700">
                                                                    High
                                                                    impact
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                    </div>
                                )}

                                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-zinc-500">
                                    {newsSummary}
                                </div>
                            </Panel>

                            <Panel className="p-5 sm:p-6">
                                <SectionHeading
                                    eyebrow="Macro Pulse"
                                    title="Market Context"
                                    description="A compact view of the fundamental forces currently visible to PAL."
                                />

                                <div className="mt-5 space-y-3">
                                    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
                                        <span className="text-xs text-zinc-500">
                                            Dollar
                                        </span>

                                        <span
                                            className={`text-sm font-semibold ${
                                                biasClasses(
                                                    dxyBias,
                                                ).text
                                            }`}
                                        >
                                            {dxyBias}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
                                        <span className="text-xs text-zinc-500">
                                            Sterling
                                        </span>

                                        <span
                                            className={`text-sm font-semibold ${
                                                biasClasses(
                                                    gbpUsdBias,
                                                ).text
                                            }`}
                                        >
                                            {gbpUsdBias}
                                        </span>
                                    </div>

                                    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.035] to-black/20 p-4 shadow-inner shadow-white/[0.02]">
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                                            Key Theme
                                        </div>

                                        <div className="mt-2 text-sm leading-6 text-zinc-300">
                                            {macroOnlyText(
                                                macro?.theme,
                                                "Relative currency strength, rates, growth and geopolitical risk are shaping the current market picture.",
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-4">
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                                            Risk Watch
                                        </div>

                                        <div className="mt-2 text-sm leading-6 text-zinc-400">
                                            {mainRisk}
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                        </div>

                        {/* LOWER NEWS STRIP */}
                        <div className="mt-5">
                            <Panel className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
                                    <SectionHeading
                                        eyebrow="News Intelligence"
                                        title="Market News"
                                    />

                                    <span className="text-[9px] uppercase tracking-wider text-zinc-700">
                                        Curated
                                    </span>
                                </div>

                                <div className="grid divide-y divide-white/[0.05] md:grid-cols-3 md:divide-x md:divide-y-0">
                                    {(
                                        Array.isArray(
                                            macro?.news,
                                        )
                                            ? macro.news
                                            : []
                                    )
                                        .slice(0, 3)
                                        .map(
                                            (
                                                item: any,
                                                index: number,
                                            ) => (
                                                <div
                                                    key={
                                                        index
                                                    }
                                                    className="p-5"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                                                        <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                                                            {item.time ??
                                                                "Latest"}
                                                        </span>
                                                    </div>

                                                    <p className="mt-3 text-sm leading-6 text-zinc-300">
                                                        {item.title ??
                                                            item.summary ??
                                                            String(
                                                                item,
                                                            )}
                                                    </p>
                                                </div>
                                            ),
                                        )}

                                    {(!Array.isArray(
                                        macro?.news,
                                    ) ||
                                        macro.news.length ===
                                            0) && (
                                        <div className="col-span-full p-10 text-center">
                                            <div className="text-sm text-zinc-400">
                                                News intelligence feed is ready.
                                            </div>

                                            <div className="mt-1 text-xs text-zinc-600">
                                                Connect the macro briefing feed to populate curated market stories here.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Panel>
                        </div>

                        <div className="py-8 text-center text-[10px] uppercase tracking-[0.18em] text-zinc-700">
                            PAL Trading Buddy · Market intelligence
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}


export default Dashboard;