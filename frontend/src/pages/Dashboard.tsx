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
        return bias.includes("LEAN") ? "LEAN_BULLISH" : "BULLISH";
    }

    if (bias.includes("BEAR")) {
        return bias.includes("LEAN") ? "LEAN_BEARISH" : "BEARISH";
    }

    return "NEUTRAL";
}


function biasClasses(bias: string) {
    if (bias === "BULLISH" || bias === "LEAN_BULLISH") {
        return {
            text: "text-emerald-300",
            soft: "bg-emerald-400/10",
            border: "border-emerald-400/20",
            dot: "bg-emerald-400",
        };
    }

    if (bias === "BEARISH" || bias === "LEAN_BEARISH") {
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
