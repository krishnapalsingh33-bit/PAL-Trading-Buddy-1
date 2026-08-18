import { useMemo, useState } from "react";

import { useJournal } from "../hooks/useJournal";

import type { JournalTrade } from "../types/journal";


type Period = 7 | 30 | 90 | 365;

type ResultFilter =
    | "ALL"
    | "WIN"
    | "LOSS"
    | "BREAKEVEN";


function formatMoney(value: number) {
    const sign = value >= 0 ? "+" : "-";

    return `${sign}$${Math.abs(value).toFixed(2)}`;
}


function formatPlainMoney(value: number) {
    return `$${Math.abs(value).toFixed(2)}`;
}


function formatPrice(value: number) {
    return value.toFixed(5);
}


function formatDuration(seconds: number) {
    if (!seconds || seconds < 60) {
        return "0m";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
}


function formatDate(value: string) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}


function formatDateTime(value: string) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}


function isWin(trade: JournalTrade) {
    return trade.result.toUpperCase() === "WIN";
}


function isLoss(trade: JournalTrade) {
    return trade.result.toUpperCase() === "LOSS";
}


function isBreakeven(trade: JournalTrade) {
    return (
        trade.result.toUpperCase() === "BREAKEVEN" ||
        trade.net_profit === 0
    );
}


function goToDashboard() {
    window.location.hash = "";
}


function SectionTitle({
    eyebrow,
    title,
    description,
}: {
    eyebrow: string;
    title: string;
    description?: string;
}) {
    return (
        <div className="mb-6">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
            </div>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                {title}
            </h2>

            {description ? (
                <p className="mt-1 text-sm text-zinc-500">
                    {description}
                </p>
            ) : null}
        </div>
    );
}


function StatCard({
    label,
    value,
    subtext,
    positive,
    negative,
}: {
    label: string;
    value: string;
    subtext?: string;
    positive?: boolean;
    negative?: boolean;
}) {
    let valueClass = "text-white";

    if (positive) {
        valueClass = "text-emerald-400";
    }

    if (negative) {
        valueClass = "text-red-400";
    }

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="text-sm text-zinc-500">
                {label}
            </div>

            <div
                className={`mt-3 text-2xl font-semibold tracking-tight ${valueClass}`}
            >
                {value}
            </div>

            {subtext ? (
                <div className="mt-2 text-xs text-zinc-600">
                    {subtext}
                </div>
            ) : null}
        </div>
    );
}


function FilterBar({
    period,
    setPeriod,
    symbol,
    setSymbol,
    result,
    setResult,
    symbolOptions,
    onRefresh,
    refreshing,
}: {
    period: Period;
    setPeriod: (value: Period) => void;
    symbol: string;
    setSymbol: (value: string) => void;
    result: ResultFilter;
    setResult: (value: ResultFilter) => void;
    symbolOptions: string[];
    onRefresh: () => void;
    refreshing: boolean;
}) {
    return (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

                <div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Journal Controls
                    </div>

                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
                        Filter Performance
                    </h2>
                </div>


                <div className="flex flex-wrap gap-3">

                    <div>
                        <label className="mb-2 block text-xs text-zinc-600">
                            Period
                        </label>

                        <select
                            value={period}
                            onChange={(event) =>
                                setPeriod(
                                    Number(
                                        event.target.value,
                                    ) as Period,
                                )
                            }
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                        >
                            <option value={7}>
                                7 Days
                            </option>

                            <option value={30}>
                                30 Days
                            </option>

                            <option value={90}>
                                90 Days
                            </option>

                            <option value={365}>
                                365 Days
                            </option>
                        </select>
                    </div>


                    <div>
                        <label className="mb-2 block text-xs text-zinc-600">
                            Symbol
                        </label>

                        <select
                            value={symbol}
                            onChange={(event) =>
                                setSymbol(
                                    event.target.value,
                                )
                            }
                            className="min-w-[150px] rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                        >
                            <option value="ALL">
                                All Symbols
                            </option>

                            {symbolOptions.map(
                                (item) => (
                                    <option
                                        key={item}
                                        value={item}
                                    >
                                        {item}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>


                    <div>
                        <label className="mb-2 block text-xs text-zinc-600">
                            Result
                        </label>

                        <select
                            value={result}
                            onChange={(event) =>
                                setResult(
                                    event.target
                                        .value as ResultFilter,
                                )
                            }
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                        >
                            <option value="ALL">
                                All Results
                            </option>

                            <option value="WIN">
                                Wins
                            </option>

                            <option value="LOSS">
                                Losses
                            </option>

                            <option value="BREAKEVEN">
                                Breakeven
                            </option>
                        </select>
                    </div>


                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {refreshing
                                ? "Refreshing..."
                                : "↻ Refresh"}
                        </button>
                    </div>

                </div>

            </div>
        </section>
    );
}


function EquityCurve({
    trades,
    startingBalance,
}: {
    trades: JournalTrade[];
    startingBalance: number;
}) {
    if (trades.length === 0) {
        return (
            <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <SectionTitle
                    eyebrow="Performance"
                    title="Equity Curve"
                    description="Filtered account progression."
                />

                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No trades match the selected filters.
                </div>
            </section>
        );
    }


    const sortedTrades = [...trades].sort(
        (a, b) =>
            new Date(a.exit_time).getTime() -
            new Date(b.exit_time).getTime(),
    );


    let balance = startingBalance;


    const points = [
        {
            balance,
            time: sortedTrades[0]?.entry_time ?? "",
        },
    ];


    for (const trade of sortedTrades) {
        balance += trade.net_profit;

        points.push({
            balance,
            time: trade.exit_time,
        });
    }


    const balances = points.map(
        (point) => point.balance,
    );


    const minBalance = Math.min(
        ...balances,
    );

    const maxBalance = Math.max(
        ...balances,
    );


    const range =
        maxBalance - minBalance === 0
            ? 1
            : maxBalance - minBalance;


    const width = 900;
    const height = 280;
    const paddingX = 28;
    const paddingY = 24;


    const chartWidth =
        width - paddingX * 2;

    const chartHeight =
        height - paddingY * 2;


    const coordinates = points.map(
        (point, index) => {

            const x =
                points.length === 1
                    ? width / 2
                    : paddingX +
                      (
                          index /
                          (points.length - 1)
                      ) *
                          chartWidth;


            const y =
                paddingY +
                (
                    1 -
                    (
                        point.balance -
                        minBalance
                    ) /
                        range
                ) *
                    chartHeight;


            return {
                x,
                y,
                balance: point.balance,
                time: point.time,
            };
        },
    );


    const line = coordinates
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" ");


    const firstPoint =
        coordinates[0];

    const lastPoint =
        coordinates[
            coordinates.length - 1
        ];


    const area =
        `${line} L ${lastPoint.x} ${height - paddingY} ` +
        `L ${firstPoint.x} ${height - paddingY} Z`;


    const currentBalance =
        points[
            points.length - 1
        ].balance;


    const change =
        currentBalance -
        startingBalance;


    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                <SectionTitle
                    eyebrow="Performance"
                    title="Equity Curve"
                    description="Filtered account progression based on completed trades."
                />

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">

                    <div className="text-xs uppercase tracking-widest text-zinc-600">
                        Filtered Change
                    </div>

                    <div
                        className={`mt-1 font-semibold ${
                            change >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                        }`}
                    >
                        {formatMoney(change)}
                    </div>

                </div>

            </div>


            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">

                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-72 w-full"
                    preserveAspectRatio="none"
                >

                    <line
                        x1={paddingX}
                        y1={paddingY}
                        x2={width - paddingX}
                        y2={paddingY}
                        stroke="rgb(39 39 42)"
                        strokeWidth="1"
                    />

                    <line
                        x1={paddingX}
                        y1={height / 2}
                        x2={width - paddingX}
                        y2={height / 2}
                        stroke="rgb(39 39 42)"
                        strokeWidth="1"
                    />

                    <line
                        x1={paddingX}
                        y1={height - paddingY}
                        x2={width - paddingX}
                        y2={height - paddingY}
                        stroke="rgb(39 39 42)"
                        strokeWidth="1"
                    />

                    <path
                        d={area}
                        fill="rgb(16 185 129)"
                        fillOpacity="0.08"
                    />

                    <path
                        d={line}
                        fill="none"
                        stroke="rgb(16 185 129)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {coordinates.map(
                        (point, index) => (
                            <circle
                                key={`${point.time}-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill="rgb(16 185 129)"
                                stroke="rgb(9 9 11)"
                                strokeWidth="2"
                            />
                        ),
                    )}

                </svg>


                <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">

                    <span>
                        {formatDate(
                            points[0]?.time ?? "",
                        )}
                    </span>

                    <span>
                        Starting{" "}
                        {formatPlainMoney(
                            startingBalance,
                        )}
                    </span>

                    <span>
                        {formatDate(
                            points[
                                points.length - 1
                            ]?.time ?? "",
                        )}
                    </span>

                </div>

            </div>

        </section>
    );
}


function DailyPerformance({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const daily = useMemo(() => {

        const map = new Map<
            string,
            {
                date: string;
                trades: number;
                wins: number;
                losses: number;
                pnl: number;
            }
        >();


        for (const trade of trades) {

            const date =
                new Date(
                    trade.exit_time,
                );


            const key =
                Number.isNaN(
                    date.getTime(),
                )
                    ? trade.exit_time.slice(
                          0,
                          10,
                      )
                    : date.toISOString().slice(
                          0,
                          10,
                      );


            const existing =
                map.get(key);


            if (existing) {

                existing.trades += 1;

                existing.pnl +=
                    trade.net_profit;


                if (isWin(trade)) {
                    existing.wins += 1;
                }


                if (isLoss(trade)) {
                    existing.losses += 1;
                }

            } else {

                map.set(key, {
                    date: key,
                    trades: 1,
                    wins: isWin(trade)
                        ? 1
                        : 0,
                    losses: isLoss(trade)
                        ? 1
                        : 0,
                    pnl: trade.net_profit,
                });

            }

        }


        return Array.from(
            map.values(),
        )
            .sort(
                (a, b) =>
                    new Date(
                        a.date,
                    ).getTime() -
                    new Date(
                        b.date,
                    ).getTime(),
            )
            .slice(-10);

    }, [trades]);


    const maxAbsPnl =
        daily.length > 0
            ? Math.max(
                  ...daily.map(
                      (item) =>
                          Math.abs(
                              item.pnl,
                          ),
                  ),
                  1,
              )
            : 1;


    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">

            <SectionTitle
                eyebrow="Performance"
                title="Daily Performance"
                description="Recent daily P&L using the selected filters."
            />


            {daily.length === 0 ? (

                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No daily performance data.
                </div>

            ) : (

                <div className="space-y-4">

                    {daily.map((day) => {

                        const width =
                            (
                                Math.abs(
                                    day.pnl,
                                ) /
                                maxAbsPnl
                            ) *
                            100;


                        return (
                            <div
                                key={day.date}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                            >

                                <div className="flex items-center justify-between gap-4">

                                    <div>

                                        <div className="font-medium text-white">
                                            {formatDate(
                                                day.date,
                                            )}
                                        </div>

                                        <div className="mt-1 text-xs text-zinc-600">
                                            {day.trades}{" "}
                                            {day.trades ===
                                            1
                                                ? "trade"
                                                : "trades"}{" "}
                                            ·{" "}
                                            {day.wins}W{" "}
                                            /{" "}
                                            {day.losses}L
                                        </div>

                                    </div>


                                    <div
                                        className={`font-semibold ${
                                            day.pnl >= 0
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                        }`}
                                    >
                                        {formatMoney(
                                            day.pnl,
                                        )}
                                    </div>

                                </div>


                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">

                                    <div
                                        className={`h-full rounded-full ${
                                            day.pnl >=
                                            0
                                                ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                                                : "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]"
                                        }`}
                                        style={{
                                            width: `${Math.max(
                                                width,
                                                3,
                                            )}%`,
                                        }}
                                    />

                                </div>

                            </div>
                        );
                    })}

                </div>
            )}

        </section>
    );
}


function PerformanceHeatmap({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const weeks = useMemo(() => {
        const today = new Date();
        const end = new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
        ));
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 83);
        start.setUTCDate(start.getUTCDate() - start.getUTCDay());

        const map = new Map<string, { pnl: number; trades: number }>();
        for (const trade of trades) {
            const date = new Date(trade.exit_time);
            if (Number.isNaN(date.getTime())) continue;
            const key = date.toISOString().slice(0, 10);
            const existing = map.get(key);
            if (existing) {
                existing.pnl += trade.net_profit;
                existing.trades += 1;
            } else {
                map.set(key, { pnl: trade.net_profit, trades: 1 });
            }
        }

        const result: { date: string; pnl: number; trades: number }[][] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            const week: { date: string; pnl: number; trades: number }[] = [];
            for (let day = 0; day < 7; day += 1) {
                const date = cursor.toISOString().slice(0, 10);
                const data = map.get(date);
                week.push({ date, pnl: data?.pnl ?? 0, trades: data?.trades ?? 0 });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            result.push(week);
        }
        return result.slice(-12);
    }, [trades]);

    const maxAbsPnl = Math.max(1, ...weeks.flat().map((day) => Math.abs(day.pnl)));
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function cellClass(pnl: number, tradeCount: number) {
        if (tradeCount === 0) return "bg-zinc-900 border-zinc-800";
        const intensity = Math.abs(pnl) / maxAbsPnl;
        if (pnl > 0) {
            if (intensity >= 0.75) return "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)] border-emerald-400";
            if (intensity >= 0.4) return "bg-emerald-700 border-emerald-600";
            return "bg-emerald-900 border-emerald-800";
        }
        if (pnl < 0) {
            if (intensity >= 0.75) return "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)] border-red-400";
            if (intensity >= 0.4) return "bg-red-700 border-red-600";
            return "bg-red-900 border-red-800";
        }
        return "bg-zinc-800 border-zinc-700";
    }

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Performance"
                title="Performance Heatmap"
                description="Daily trading activity and P&L intensity from the selected filters."
            />

            {trades.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No heatmap data for the selected filters.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="min-w-[720px]">
                        <div className="mb-3 grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-2">
                            <div />
                            {dayLabels.map((label) => (
                                <div key={label} className="text-center text-[10px] uppercase tracking-wider text-zinc-600">
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            {weeks.map((week, weekIndex) => (
                                <div key={week[0]?.date ?? weekIndex} className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-2">
                                    <div className="flex items-center text-[10px] text-zinc-700">
                                        {weekIndex === 0 || new Date(week[0].date).getUTCMonth() !== new Date(weeks[weekIndex - 1][0].date).getUTCMonth()
                                            ? new Date(`${week[0].date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })
                                            : ""}
                                    </div>

                                    {week.map((day) => (
                                        <div
                                            key={day.date}
                                            title={`${formatDate(day.date)} · ${day.trades} ${day.trades === 1 ? "trade" : "trades"} · ${formatMoney(day.pnl)}`}
                                            className={`h-8 rounded-md border ${cellClass(day.pnl, day.trades)} transition hover:scale-105`}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                            <div className="text-xs text-zinc-600">Empty = no trades</div>
                            <div className="flex items-center gap-2 text-xs text-zinc-600">
                                <span>Loss</span>
                                <span className="h-3 w-3 rounded-sm border border-red-800 bg-red-900" />
                                <span className="h-3 w-3 rounded-sm border border-red-600 bg-red-700" />
                                <span className="h-3 w-3 rounded-sm border border-red-400 bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]" />
                                <span className="mx-1 text-zinc-800">|</span>
                                <span className="h-3 w-3 rounded-sm border border-emerald-800 bg-emerald-900" />
                                <span className="h-3 w-3 rounded-sm border border-emerald-600 bg-emerald-700" />
                                <span className="h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]" />
                                <span>Profit</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}


function DayOfWeekPerformance({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const days = useMemo(() => {
        const names = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
        ];

        const map = new Map<
            string,
            {
                day: string;
                trades: number;
                wins: number;
                losses: number;
                pnl: number;
            }
        >();

        for (const name of names) {
            map.set(name, {
                day: name,
                trades: 0,
                wins: 0,
                losses: 0,
                pnl: 0,
            });
        }

        for (const trade of trades) {
            const date = new Date(trade.exit_time);

            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const dayIndex = date.getDay();

            if (dayIndex === 0 || dayIndex === 6) {
                continue;
            }

            const name = names[dayIndex - 1];
            const existing = map.get(name);

            if (!existing) {
                continue;
            }

            existing.trades += 1;
            existing.pnl += trade.net_profit;

            if (isWin(trade)) {
                existing.wins += 1;
            }

            if (isLoss(trade)) {
                existing.losses += 1;
            }
        }

        return names.map(
            (name) => map.get(name)!,
        );
    }, [trades]);

    const activeDays = days.filter(
        (day) => day.trades > 0,
    );

    const maxAbsPnl = Math.max(
        1,
        ...activeDays.map((day) =>
            Math.abs(day.pnl),
        ),
    );

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Performance"
                title="P&L by Day of Week"
                description="See which trading days have produced the strongest results."
            />

            {activeDays.length === 0 ? (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No weekday performance data for the selected filters.
                </div>
            ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {days.map((day) => {
                        const winRate =
                            day.trades > 0
                                ? (day.wins / day.trades) * 100
                                : 0;

                        const barWidth =
                            day.trades > 0
                                ? Math.max(
                                      (Math.abs(day.pnl) /
                                          maxAbsPnl) *
                                          100,
                                      4,
                                  )
                                : 0;

                        return (
                            <div
                                key={day.day}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold tracking-tight text-white">
                                            {day.day}
                                        </p>

                                        <p className="mt-1 text-xs text-zinc-600">
                                            {day.trades}{" "}
                                            {day.trades === 1
                                                ? "trade"
                                                : "trades"}
                                        </p>
                                    </div>

                                    <p
                                        className={`text-sm font-semibold ${
                                            day.pnl > 0
                                                ? "text-emerald-400"
                                                : day.pnl < 0
                                                  ? "text-red-400"
                                                  : "text-zinc-500"
                                        }`}
                                    >
                                        {formatMoney(day.pnl)}
                                    </p>
                                </div>

                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                                    {day.trades > 0 && (
                                        <div
                                            className={`h-full rounded-full ${
                                                day.pnl >= 0
                                                    ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                                                    : "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]"
                                            }`}
                                            style={{
                                                width: `${barWidth}%`,
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="mt-4 flex items-center justify-between text-xs">
                                    <span className="text-zinc-600">
                                        Win rate
                                    </span>

                                    <span className="font-medium text-zinc-300">
                                        {winRate.toFixed(0)}%
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="text-zinc-600">
                                        W / L
                                    </span>

                                    <span className="text-zinc-400">
                                        {day.wins}W / {day.losses}L
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}


function SessionPerformance({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const sessions = useMemo(() => {
        const result = [
            {
                name: "London",
                description: "07:00–11:59 UTC",
                trades: 0,
                wins: 0,
                losses: 0,
                pnl: 0,
            },
            {
                name: "New York",
                description: "12:00–20:59 UTC",
                trades: 0,
                wins: 0,
                losses: 0,
                pnl: 0,
            },
            {
                name: "Other",
                description: "21:00–06:59 UTC",
                trades: 0,
                wins: 0,
                losses: 0,
                pnl: 0,
            },
        ];

        for (const trade of trades) {
            const date = new Date(trade.entry_time);

            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const hour = date.getUTCHours();

            const session =
                hour >= 7 && hour < 12
                    ? result[0]
                    : hour >= 12 && hour < 21
                      ? result[1]
                      : result[2];

            session.trades += 1;
            session.pnl += trade.net_profit;

            if (isWin(trade)) {
                session.wins += 1;
            }

            if (isLoss(trade)) {
                session.losses += 1;
            }
        }

        return result;
    }, [trades]);

    const activeSessions = sessions.filter(
        (session) => session.trades > 0,
    );

    const maxAbsPnl = Math.max(
        1,
        ...activeSessions.map((session) =>
            Math.abs(session.pnl),
        ),
    );

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Performance"
                title="Session Performance"
                description="Compare results by the UTC entry-time windows used by the journal."
            />

            <div className="mt-3 text-xs text-zinc-600">
                Session labels use UTC entry time; they are a consistent
                journal classification and are not a broker-session/DST
                calendar.
            </div>

            {activeSessions.length === 0 ? (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No session performance data for the selected filters.
                </div>
            ) : (
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {sessions.map((session) => {
                        const winRate =
                            session.trades > 0
                                ? (session.wins /
                                      session.trades) *
                                  100
                                : 0;

                        const barWidth =
                            session.trades > 0
                                ? Math.max(
                                      (Math.abs(
                                          session.pnl,
                                      ) /
                                          maxAbsPnl) *
                                          100,
                                      4,
                                  )
                                : 0;

                        return (
                            <div
                                key={session.name}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-semibold tracking-tight text-white">
                                            {session.name}
                                        </div>

                                        <div className="mt-1 text-xs text-zinc-600">
                                            {session.description}
                                        </div>
                                    </div>

                                    <div
                                        className={`text-sm font-semibold ${
                                            session.pnl > 0
                                                ? "text-emerald-400"
                                                : session.pnl < 0
                                                  ? "text-red-400"
                                                  : "text-zinc-500"
                                        }`}
                                    >
                                        {formatMoney(
                                            session.pnl,
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                                    {session.trades > 0 && (
                                        <div
                                            className={`h-full rounded-full ${
                                                session.pnl >= 0
                                                    ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                                                    : "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]"
                                            }`}
                                            style={{
                                                width: `${barWidth}%`,
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="mt-5 grid grid-cols-3 gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                                            Trades
                                        </div>
                                        <div className="mt-1 font-semibold text-zinc-200">
                                            {session.trades}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                                            Win Rate
                                        </div>
                                        <div className="mt-1 font-semibold text-zinc-200">
                                            {winRate.toFixed(0)}%
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                                            W / L
                                        </div>
                                        <div className="mt-1 font-semibold text-zinc-200">
                                            {session.wins} /{" "}
                                            {session.losses}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}


function DrawdownAnalysis({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const analysis = useMemo(() => {
        const sorted = [...trades].sort(
            (a, b) =>
                new Date(a.exit_time).getTime() -
                new Date(b.exit_time).getTime(),
        );

        let cumulative = 0;
        let peak = 0;
        let maxDrawdown = 0;
        let currentDrawdown = 0;
        let peakAtMaxDrawdown = 0;
        let troughAtMaxDrawdown = 0;

        const points: {
            time: string;
            drawdown: number;
        }[] = [];

        for (const trade of sorted) {
            cumulative += trade.net_profit;

            if (cumulative > peak) {
                peak = cumulative;
            }

            currentDrawdown =
                Math.min(0, cumulative - peak);

            if (Math.abs(currentDrawdown) > Math.abs(maxDrawdown)) {
                maxDrawdown = currentDrawdown;
                peakAtMaxDrawdown = peak;
                troughAtMaxDrawdown = cumulative;
            }

            points.push({
                time: trade.exit_time,
                drawdown: currentDrawdown,
            });
        }

        return {
            points,
            maxDrawdown,
            currentDrawdown,
            peakAtMaxDrawdown,
            troughAtMaxDrawdown,
        };
    }, [trades]);

    const maxAbsDrawdown = Math.max(
        1,
        ...analysis.points.map((point) =>
            Math.abs(point.drawdown),
        ),
    );

    const chartPoints = analysis.points
        .map((point, index) => {
            const x =
                analysis.points.length <= 1
                    ? 50
                    : (index /
                          (analysis.points.length - 1)) *
                      100;

            const y =
                100 -
                (Math.abs(point.drawdown) /
                    maxAbsDrawdown) *
                    100;

            return `${x},${Math.max(y, 4)}`;
        })
        .join(" ");

    const recovery =
        analysis.currentDrawdown === 0;

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Risk"
                title="Drawdown Analysis"
                description="See how far the filtered equity path moved below its previous peak."
            />

            {trades.length === 0 ? (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No drawdown data for the selected filters.
                </div>
            ) : (
                <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Maximum Drawdown
                            </div>

                            <div className="mt-2 text-2xl font-bold text-red-400">
                                {formatMoney(
                                    analysis.maxDrawdown,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Current Drawdown
                            </div>

                            <div
                                className={`mt-2 text-2xl font-bold ${
                                    recovery
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                }`}
                            >
                                {recovery
                                    ? "Recovered"
                                    : formatMoney(
                                          analysis.currentDrawdown,
                                      )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Peak Before Max DD
                            </div>

                            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                                {formatMoney(
                                    analysis.peakAtMaxDrawdown,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Trough
                            </div>

                            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                                {formatMoney(
                                    analysis.troughAtMaxDrawdown,
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">
                                    Drawdown Curve
                                </p>

                                <p className="mt-1 text-xs text-zinc-600">
                                    Zero means the equity path is at a previous peak.
                                </p>
                            </div>

                            <div
                                className={`text-sm font-semibold ${
                                    recovery
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                }`}
                            >
                                {recovery
                                    ? "At peak"
                                    : "Below peak"}
                            </div>
                        </div>

                        <div className="h-56">
                            <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                className="h-full w-full"
                            >
                                <line
                                    x1="0"
                                    y1="0"
                                    x2="100"
                                    y2="0"
                                    stroke="currentColor"
                                    className="text-zinc-800"
                                />

                                <line
                                    x1="0"
                                    y1="50"
                                    x2="100"
                                    y2="50"
                                    stroke="currentColor"
                                    className="text-zinc-900"
                                />

                                {analysis.points.length > 1 && (
                                    <polyline
                                        points={chartPoints}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        className="text-red-400"
                                    />
                                )}
                            </svg>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
                            <span>
                                {analysis.points[0]
                                    ? formatDate(
                                          analysis.points[0].time,
                                      )
                                    : "—"}
                            </span>

                            <span>
                                {analysis.points.at(-1)
                                    ? formatDate(
                                          analysis.points.at(-1)!.time,
                                      )
                                    : "—"}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}


function TradeDurationAnalysis({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const analysis = useMemo(() => {
        const winners = trades.filter(isWin);
        const losers = trades.filter(isLoss);

        const average = (items: JournalTrade[]) => {
            if (items.length === 0) {
                return 0;
            }

            return (
                items.reduce(
                    (total, trade) =>
                        total +
                        trade.duration_seconds,
                    0,
                ) / items.length
            );
        };

        const shortest =
            trades.length > 0
                ? [...trades].sort(
                      (a, b) =>
                          a.duration_seconds -
                          b.duration_seconds,
                  )[0]
                : null;

        const longest =
            trades.length > 0
                ? [...trades].sort(
                      (a, b) =>
                          b.duration_seconds -
                          a.duration_seconds,
                  )[0]
                : null;

        return {
            average: average(trades),
            averageWin: average(winners),
            averageLoss: average(losers),
            shortest,
            longest,
        };
    }, [trades]);

    const difference =
        analysis.averageWin -
        analysis.averageLoss;

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Execution"
                title="Trade Duration Analysis"
                description="Compare how long winning and losing trades are held."
            />

            {trades.length === 0 ? (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No duration data for the selected filters.
                </div>
            ) : (
                <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Average Hold
                            </div>

                            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                                {formatDuration(
                                    analysis.average,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Winning Trades
                            </div>

                            <div className="mt-2 text-2xl font-bold text-emerald-400">
                                {formatDuration(
                                    analysis.averageWin,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Losing Trades
                            </div>

                            <div className="mt-2 text-2xl font-bold text-red-400">
                                {formatDuration(
                                    analysis.averageLoss,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Winner vs Loser
                            </div>

                            <div
                                className={`mt-2 text-2xl font-bold ${
                                    difference >= 0
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                }`}
                            >
                                {difference >= 0
                                    ? "+"
                                    : "-"}
                                {formatDuration(
                                    Math.abs(
                                        difference,
                                    ),
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-200">
                                        Shortest Trade
                                    </p>

                                    <p className="mt-1 text-xs text-zinc-600">
                                        {analysis.shortest
                                            ? analysis.shortest.symbol
                                            : "—"}
                                    </p>
                                </div>

                                <p className="text-sm font-semibold text-zinc-300">
                                    {analysis.shortest
                                        ? formatDuration(
                                              analysis.shortest
                                                  .duration_seconds,
                                          )
                                        : "—"}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-200">
                                        Longest Trade
                                    </p>

                                    <p className="mt-1 text-xs text-zinc-600">
                                        {analysis.longest
                                            ? analysis.longest.symbol
                                            : "—"}
                                    </p>
                                </div>

                                <p className="text-sm font-semibold text-zinc-300">
                                    {analysis.longest
                                        ? formatDuration(
                                              analysis.longest
                                                  .duration_seconds,
                                          )
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}


function WinLossDistribution({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const analysis = useMemo(() => {
        const wins = trades
            .filter(isWin)
            .map((trade) => trade.net_profit);

        const losses = trades
            .filter(isLoss)
            .map((trade) => trade.net_profit);

        const average = (values: number[]) => {
            if (values.length === 0) {
                return 0;
            }

            return (
                values.reduce(
                    (total, value) =>
                        total + value,
                    0,
                ) / values.length
            );
        };

        return {
            wins,
            losses,
            averageWin: average(wins),
            averageLoss: average(losses),
            largestWin:
                wins.length > 0
                    ? Math.max(...wins)
                    : 0,
            largestLoss:
                losses.length > 0
                    ? Math.min(...losses)
                    : 0,
        };
    }, [trades]);

    const maxWin =
        analysis.wins.length > 0
            ? Math.max(...analysis.wins)
            : 0;

    const maxLossAbs =
        analysis.losses.length > 0
            ? Math.abs(
                  Math.min(...analysis.losses),
              )
            : 0;

    const scale = Math.max(
        1,
        maxWin,
        maxLossAbs,
    );

    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <SectionTitle
                eyebrow="Performance"
                title="Win / Loss Distribution"
                description="Compare the size and frequency of your winning and losing trades."
            />

            {trades.length === 0 ? (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] text-sm text-zinc-600">
                    No win/loss distribution data for the selected filters.
                </div>
            ) : (
                <>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Winning Trades
                            </div>

                            <div className="mt-2 text-2xl font-bold text-emerald-400">
                                {analysis.wins.length}
                            </div>

                            <div className="mt-1 text-xs text-zinc-600">
                                Avg{" "}
                                {formatMoney(
                                    analysis.averageWin,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Losing Trades
                            </div>

                            <div className="mt-2 text-2xl font-bold text-red-400">
                                {analysis.losses.length}
                            </div>

                            <div className="mt-1 text-xs text-zinc-600">
                                Avg{" "}
                                {formatMoney(
                                    analysis.averageLoss,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Largest Win
                            </div>

                            <div className="mt-2 text-2xl font-bold text-emerald-400">
                                {formatMoney(
                                    analysis.largestWin,
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02]">
                            <div className="text-xs uppercase tracking-wider text-zinc-600">
                                Largest Loss
                            </div>

                            <div className="mt-2 text-2xl font-bold text-red-400">
                                {formatMoney(
                                    analysis.largestLoss,
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">
                                            Average Win
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-600">
                                            {analysis.wins.length} winning trades
                                        </p>
                                    </div>

                                    <span className="font-semibold text-emerald-400">
                                        {formatMoney(
                                            analysis.averageWin,
                                        )}
                                    </span>
                                </div>

                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                                        style={{
                                            width: `${analysis.averageWin > 0 ? Math.max(
                                                (analysis.averageWin /
                                                    scale) *
                                                    100,
                                                4,
                                            ) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">
                                            Average Loss
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-600">
                                            {analysis.losses.length} losing trades
                                        </p>
                                    </div>

                                    <span className="font-semibold text-red-400">
                                        {formatMoney(
                                            analysis.averageLoss,
                                        )}
                                    </span>
                                </div>

                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className="h-full rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]"
                                        style={{
                                            width: `${analysis.averageLoss < 0 ? Math.max(
                                                (Math.abs(
                                                    analysis.averageLoss,
                                                ) /
                                                    scale) *
                                                    100,
                                                4,
                                            ) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}


function TradeQuality({
    trades,
}: {
    trades: JournalTrade[];
}) {
    if (trades.length === 0) {

        return (
            <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">

                <SectionTitle
                    eyebrow="Analysis"
                    title="Trade Quality"
                    description="Journal-based performance indicators."
                />

                <div className="rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-zinc-600">
                    No trades match the selected filters.
                </div>

            </section>
        );
    }


    const wins =
        trades.filter(isWin).length;

    const losses =
        trades.filter(isLoss).length;


    const totalProfit =
        trades.reduce(
            (sum, trade) =>
                sum + trade.net_profit,
            0,
        );


    const averageProfit =
        totalProfit /
        trades.length;


    const averageDuration =
        trades.reduce(
            (sum, trade) =>
                sum +
                trade.duration_seconds,
            0,
        ) /
        trades.length;


    const winRate =
        (wins / trades.length) * 100;


    const entryTiming =
        Math.min(
            10,
            Math.max(
                1,
                5 +
                    (winRate - 50) /
                        20,
            ),
        );


    const execution =
        averageProfit >= 0
            ? 8
            : 5;


    const exitTiming =
        wins > losses
            ? 8
            : wins === losses
                ? 7
                : 6;


    const riskManagement =
        losses === 0
            ? 9
            : wins > losses
                ? 8
                : 6;


    const discipline =
        trades.length <= 5
            ? 8
            : trades.length <= 15
                ? 7
                : 6;


    const patience =
        averageDuration >=
        30 * 60
            ? 9
            : averageDuration >=
                15 * 60
                ? 8
                : averageDuration >=
                    5 * 60
                    ? 7
                    : 6;


    const scores = [
        {
            label: "Entry Timing",
            value: entryTiming,
        },
        {
            label: "Execution",
            value: execution,
        },
        {
            label: "Exit Timing",
            value: exitTiming,
        },
        {
            label: "Risk Management",
            value: riskManagement,
        },
        {
            label: "Discipline",
            value: discipline,
        },
        {
            label: "Patience",
            value: patience,
        },
    ];


    const overall =
        scores.reduce(
            (sum, item) =>
                sum + item.value,
            0,
        ) /
        scores.length;


    return (
        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

                <SectionTitle
                    eyebrow="Analysis"
                    title="Trade Quality"
                    description="Journal-based performance indicators."
                />


                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-4 text-center">

                    <div className="text-xs uppercase tracking-widest text-zinc-600">
                        Overall
                    </div>

                    <div className="mt-1 text-3xl font-bold tracking-tight text-white">
                        {overall.toFixed(1)}
                        <span className="text-base text-zinc-600">
                            {" "}
                            / 10
                        </span>
                    </div>

                </div>

            </div>


            <div className="grid gap-4 md:grid-cols-2">

                {scores.map(
                    (score) => (

                        <div
                            key={
                                score.label
                            }
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >

                            <div className="flex items-center justify-between">

                                <span className="text-sm text-zinc-400">
                                    {
                                        score.label
                                    }
                                </span>

                                <span className="font-semibold tracking-tight text-white">
                                    {score.value.toFixed(
                                        1,
                                    )}
                                </span>

                            </div>


                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">

                                <div
                                    className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                                    style={{
                                        width: `${score.value * 10}%`,
                                    }}
                                />

                            </div>

                        </div>
                    ),
                )}

            </div>


            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">

                <div className="text-xs leading-5 text-zinc-600">
                    These indicators use only completed
                    MT5 trade data. They do not evaluate
                    your personal trading strategy or
                    market setup quality.
                </div>

            </div>

        </section>
    );
}


function TradeSpotlight({
    title,
    trade,
}: {
    title: string;
    trade: JournalTrade | null;
}) {
    if (!trade) {

        return (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">

                <div className="text-xs uppercase tracking-widest text-zinc-500">
                    {title}
                </div>

                <div className="mt-4 text-sm text-zinc-600">
                    No trade available.
                </div>

            </div>
        );
    }


    const positive =
        trade.net_profit >= 0;


    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">

            <div className="text-xs uppercase tracking-widest text-zinc-500">
                {title}
            </div>


            <div className="mt-4 flex items-center justify-between">

                <div>

                    <div className="text-lg font-semibold tracking-tight text-white">
                        {trade.symbol}
                    </div>

                    <div className="mt-1 text-xs text-zinc-600">
                        {trade.direction} ·{" "}
                        {formatDateTime(
                            trade.exit_time,
                        )}
                    </div>

                </div>


                <div
                    className={`text-lg font-semibold ${
                        positive
                            ? "text-emerald-400"
                            : "text-red-400"
                    }`}
                >
                    {formatMoney(
                        trade.net_profit,
                    )}
                </div>

            </div>


            <div className="mt-5 grid grid-cols-2 gap-3">

                <div className="rounded-lg bg-zinc-950 p-3">

                    <div className="text-xs text-zinc-600">
                        Entry
                    </div>

                    <div className="mt-1 text-sm text-zinc-300">
                        {formatPrice(
                            trade.entry_price,
                        )}
                    </div>

                </div>


                <div className="rounded-lg bg-zinc-950 p-3">

                    <div className="text-xs text-zinc-600">
                        Exit
                    </div>

                    <div className="mt-1 text-sm text-zinc-300">
                        {formatPrice(
                            trade.exit_price,
                        )}
                    </div>

                </div>


                <div className="rounded-lg bg-zinc-950 p-3">

                    <div className="text-xs text-zinc-600">
                        Duration
                    </div>

                    <div className="mt-1 text-sm text-zinc-300">
                        {formatDuration(
                            trade.duration_seconds,
                        )}
                    </div>

                </div>


                <div className="rounded-lg bg-zinc-950 p-3">

                    <div className="text-xs text-zinc-600">
                        Volume
                    </div>

                    <div className="mt-1 text-sm text-zinc-300">
                        {trade.volume}
                    </div>

                </div>

            </div>

        </div>
    );
}


function TradeHistory({
    trades,
}: {
    trades: JournalTrade[];
}) {
    const [showAll, setShowAll] = useState(false);

    const [selectedTrade, setSelectedTrade] =
        useState<JournalTrade | null>(null);

    const visibleTrades = showAll
        ? trades
        : trades.slice(0, 15);

    function formatMoney(value: number) {
        if (value >= 0) {
            return `+$${value.toFixed(2)}`;
        }

        return `-$${Math.abs(value).toFixed(2)}`;
    }

    function formatDuration(seconds: number) {
        const minutes = Math.floor(seconds / 60);

        if (minutes < 1) {
            return "0m";
        }

        if (minutes < 60) {
            return `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    function formatPrice(value: number) {
        return value.toFixed(5);
    }

    function formatDate(value: string) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function isWinningTrade(trade: JournalTrade) {
        return trade.net_profit > 0;
    }

    function isLosingTrade(trade: JournalTrade) {
        return trade.net_profit < 0;
    }

    if (trades.length === 0) {
        return (
            <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                            Journal
                        </p>

                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            Recent Trades
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            Completed trades matching the current filters.
                        </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-sm text-zinc-500">
                        0 total
                    </div>
                </div>

                <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
                    <p className="text-sm text-zinc-500">
                        No completed trades available.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <>
            <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                            Journal
                        </p>

                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            Recent Trades
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                            Completed trades matching the current filters.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-sm text-zinc-400">
                            {trades.length} total
                        </div>

                        {trades.length > 15 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setShowAll((current) => !current)
                                }
                                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                            >
                                {showAll
                                    ? "Hide all"
                                    : "View all"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left">
                        <thead>
                            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-600">
                                <th className="px-3 py-4 font-medium">
                                    Symbol
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Direction
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Volume
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Entry
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Exit
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Duration
                                </th>

                                <th className="px-3 py-4 font-medium">
                                    Result
                                </th>

                                <th className="px-3 py-4 text-right font-medium">
                                    Net P&L
                                </th>

                                <th className="px-3 py-4 text-right font-medium">
                                    Action
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleTrades.map((trade) => {
                                const profit =
                                    isWinningTrade(trade);

                                const loss =
                                    isLosingTrade(trade);

                                return (
                                    <tr
                                        key={`${trade.position_id}-${trade.exit_ticket}`}
                                        className="border-b border-zinc-800/70 last:border-0"
                                    >
                                        <td className="px-3 py-5">
                                            <div className="font-semibold tracking-tight text-white">
                                                {trade.symbol}
                                            </div>

                                            <div className="mt-1 text-xs text-zinc-600">
                                                {formatDate(
                                                    trade.exit_time,
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-3 py-5">
                                            <span
                                                className={
                                                    trade.direction.toUpperCase() ===
                                                    "BUY"
                                                        ? "rounded-lg bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                                                        : "rounded-lg bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-red-400"
                                                }
                                            >
                                                {trade.direction.toUpperCase()}
                                            </span>
                                        </td>

                                        <td className="px-3 py-5 text-zinc-300">
                                            {trade.volume}
                                        </td>

                                        <td className="px-3 py-5 font-mono text-sm text-zinc-300">
                                            {formatPrice(
                                                trade.entry_price,
                                            )}
                                        </td>

                                        <td className="px-3 py-5 font-mono text-sm text-zinc-300">
                                            {formatPrice(
                                                trade.exit_price,
                                            )}
                                        </td>

                                        <td className="px-3 py-5 text-zinc-400">
                                            {formatDuration(
                                                trade.duration_seconds,
                                            )}
                                        </td>

                                        <td className="px-3 py-5">
                                            <span
                                                className={
                                                    profit
                                                        ? "rounded-lg bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                                                        : loss
                                                          ? "rounded-lg bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-red-400"
                                                          : "rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400"
                                                }
                                            >
                                                {trade.result}
                                            </span>
                                        </td>

                                        <td className="px-3 py-5 text-right">
                                            <span
                                                className={
                                                    profit
                                                        ? "font-semibold text-emerald-400"
                                                        : loss
                                                          ? "font-semibold text-red-400"
                                                          : "font-semibold text-zinc-400"
                                                }
                                            >
                                                {formatMoney(
                                                    trade.net_profit,
                                                )}
                                            </span>
                                        </td>

                                        <td className="px-3 py-5 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedTrade(
                                                        trade,
                                                    )
                                                }
                                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {!showAll && trades.length > 15 && (
                    <div className="mt-4 text-center text-xs text-zinc-600">
                        Showing the latest 15 trades
                    </div>
                )}
            </section>

            {selectedTrade && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() =>
                        setSelectedTrade(null)
                    }
                >
                    <div
                        className="w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl shadow-2xl"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                    Trade Details
                                </p>

                                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                                    {selectedTrade.symbol}
                                </h2>

                                <p className="mt-1 text-sm text-zinc-500">
                                    {formatDate(
                                        selectedTrade.entry_time,
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSelectedTrade(null)
                                }
                                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                                <div className="text-xs uppercase tracking-wider text-zinc-600">
                                    Result
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span
                                        className={
                                            selectedTrade.net_profit > 0
                                                ? "rounded-lg bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                                                : selectedTrade.net_profit < 0
                                                  ? "rounded-lg bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)]/10 px-3 py-1.5 text-xs font-semibold text-red-400"
                                                  : "rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400"
                                        }
                                    >
                                        {selectedTrade.result}
                                    </span>

                                    <span
                                        className={
                                            selectedTrade.net_profit >= 0
                                                ? "text-xl font-semibold text-emerald-400"
                                                : "text-xl font-semibold text-red-400"
                                        }
                                    >
                                        {formatMoney(
                                            selectedTrade.net_profit,
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                                <div className="text-xs uppercase tracking-wider text-zinc-600">
                                    Direction
                                </div>

                                <div className="mt-2 text-lg font-semibold tracking-tight text-white">
                                    {selectedTrade.direction.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Entry
                                </div>

                                <div className="mt-2 font-mono text-sm text-white">
                                    {formatPrice(
                                        selectedTrade.entry_price,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Exit
                                </div>

                                <div className="mt-2 font-mono text-sm text-white">
                                    {formatPrice(
                                        selectedTrade.exit_price,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Volume
                                </div>

                                <div className="mt-2 text-sm text-white">
                                    {selectedTrade.volume}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Duration
                                </div>

                                <div className="mt-2 text-sm text-white">
                                    {formatDuration(
                                        selectedTrade.duration_seconds,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Entry Time
                                </div>

                                <div className="mt-2 text-sm text-white">
                                    {formatDate(
                                        selectedTrade.entry_time,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Exit Time
                                </div>

                                <div className="mt-2 text-sm text-white">
                                    {formatDate(
                                        selectedTrade.exit_time,
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Commission
                                </div>

                                <div className="mt-2 text-sm text-zinc-300">
                                    {formatMoney(
                                        selectedTrade.commission,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Swap
                                </div>

                                <div className="mt-2 text-sm text-zinc-300">
                                    {formatMoney(
                                        selectedTrade.swap,
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Fee
                                </div>

                                <div className="mt-2 text-sm text-zinc-300">
                                    {formatMoney(
                                        selectedTrade.fee,
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Entry Ticket
                                </div>

                                <div className="mt-2 font-mono text-sm text-zinc-300">
                                    {selectedTrade.entry_ticket}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    Exit Ticket
                                </div>

                                <div className="mt-2 font-mono text-sm text-zinc-300">
                                    {selectedTrade.exit_ticket}
                                </div>
                            </div>
                        </div>

                        {selectedTrade.comment && (
                            <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">
                                <div className="text-xs text-zinc-600">
                                    MT5 Comment
                                </div>

                                <div className="mt-2 text-sm text-zinc-300">
                                    {selectedTrade.comment}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function JournalTest() {

    const [period, setPeriod] =
        useState<Period>(30);

    const [symbol, setSymbol] =
        useState("ALL");

    const [result, setResult] =
        useState<ResultFilter>("ALL");


    const {
        data: response,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useJournal(period);


    const allTrades =
        response?.data?.trades ?? [];


    const symbols =
        useMemo(() => {

            return Array.from(
                new Set(
                    allTrades
                        .map(
                            (trade) =>
                                trade.symbol,
                        )
                        .filter(Boolean),
                ),
            ).sort();

        }, [allTrades]);


    /*
     * If the currently selected symbol
     * no longer exists after changing
     * the period, reset it automatically.
     */

    useMemo(() => {

        if (
            symbol !== "ALL" &&
            !symbols.includes(symbol)
        ) {
            setSymbol("ALL");
        }

        return null;

    }, [symbol, symbols]);


    const filteredTrades =
        useMemo(() => {

            return allTrades.filter(
                (trade) => {

                    const symbolMatches =
                        symbol === "ALL" ||
                        trade.symbol ===
                            symbol;


                    let resultMatches = true;


                    if (
                        result ===
                        "WIN"
                    ) {
                        resultMatches =
                            isWin(
                                trade,
                            );
                    }


                    if (
                        result ===
                        "LOSS"
                    ) {
                        resultMatches =
                            isLoss(
                                trade,
                            );
                    }


                    if (
                        result ===
                        "BREAKEVEN"
                    ) {
                        resultMatches =
                            isBreakeven(
                                trade,
                            );
                    }


                    return (
                        symbolMatches &&
                        resultMatches
                    );
                },
            );

        }, [
            allTrades,
            symbol,
            result,
        ]);


    const filteredStatistics =
        useMemo(() => {

            const totalTrades =
                filteredTrades.length;


            const wins =
                filteredTrades.filter(
                    isWin,
                ).length;


            const losses =
                filteredTrades.filter(
                    isLoss,
                ).length;


            const breakeven =
                filteredTrades.filter(
                    isBreakeven,
                ).length;


            const grossProfit =
                filteredTrades
                    .filter(
                        (trade) =>
                            trade.net_profit >
                            0,
                    )
                    .reduce(
                        (
                            sum,
                            trade,
                        ) =>
                            sum +
                            trade.net_profit,
                        0,
                    );


            const grossLoss =
                filteredTrades
                    .filter(
                        (trade) =>
                            trade.net_profit <
                            0,
                    )
                    .reduce(
                        (
                            sum,
                            trade,
                        ) =>
                            sum +
                            trade.net_profit,
                        0,
                    );


            const netProfit =
                filteredTrades.reduce(
                    (
                        sum,
                        trade,
                    ) =>
                        sum +
                        trade.net_profit,
                    0,
                );


            const averageWin =
                wins > 0
                    ? grossProfit /
                      wins
                    : 0;


            const averageLoss =
                losses > 0
                    ? grossLoss /
                      losses
                    : 0;


            const profitFactor =
                grossLoss < 0
                    ? grossProfit /
                      Math.abs(
                          grossLoss,
                      )
                    : null;


            const averageDuration =
                totalTrades > 0
                    ? filteredTrades.reduce(
                          (
                              sum,
                              trade,
                          ) =>
                              sum +
                              trade.duration_seconds,
                          0,
                      ) /
                      totalTrades
                    : 0;


            const winRate =
                totalTrades > 0
                    ? (
                          wins /
                          totalTrades
                      ) *
                      100
                    : 0;


            const sorted =
                [...filteredTrades].sort(
                    (a, b) =>
                        b.net_profit -
                        a.net_profit,
                );


            return {

                total_trades:
                    totalTrades,

                wins,

                losses,

                breakeven,

                win_rate:
                    winRate,

                gross_profit:
                    grossProfit,

                gross_loss:
                    grossLoss,

                net_profit:
                    netProfit,

                average_win:
                    averageWin,

                average_loss:
                    averageLoss,

                profit_factor:
                    profitFactor,

                average_duration_seconds:
                    averageDuration,

                best_trade:
    sorted.length > 0
        ? sorted[0]
        : null,

worst_trade:
    sorted.length > 1
        ? sorted[sorted.length - 1]
        : null,

            };

        }, [
            filteredTrades,
        ]);


    const filteredStartingBalance =
        useMemo(() => {

            if (
                !response?.data?.account
            ) {
                return 0;
            }

            return (
                response.data.account
                    .balance -
                filteredStatistics.net_profit
            );

        }, [
            response,
            filteredStatistics.net_profit,
        ]);


    if (isLoading) {

        return (
            <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white">

                <div className="mx-auto max-w-7xl">

                    <button
                        type="button"
                        onClick={
                            goToDashboard
                        }
                        className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                        ← Back to Dashboard
                    </button>


                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-10 text-center">

                        <div className="text-lg font-medium text-white">
                            Loading Trading Journal...
                        </div>

                        <div className="mt-2 text-sm text-zinc-600">
                            Reading the latest MT5 data.
                        </div>

                    </div>

                </div>

            </div>
        );
    }


    if (
        isError ||
        !response?.success ||
        !response.data
    ) {

        return (
            <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white">

                <div className="mx-auto max-w-7xl">

                    <button
                        type="button"
                        onClick={
                            goToDashboard
                        }
                        className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                        ← Back to Dashboard
                    </button>


                    <div className="rounded-2xl border border-red-900/50 bg-zinc-900 p-10 text-center">

                        <div className="text-lg font-semibold text-red-400">
                            Unable to load journal
                        </div>


                        <div className="mt-2 text-sm text-zinc-500">

                            {error instanceof Error
                                ? error.message
                                : "The journal API returned an error."}

                        </div>


                        <button
                            type="button"
                            onClick={() => {
                                void refetch();
                            }}
                            className="mt-6 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                        >
                            Try Again
                        </button>

                    </div>

                </div>

            </div>
        );
    }


    const journal =
        response.data;


    return (
        <div className="min-h-screen bg-zinc-950 text-white">

            <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-indigo-500/[0.08] via-white/[0.025] to-cyan-500/[0.06] px-4 py-3 shadow-[0_20px_60px_-40px_rgba(99,102,241,0.5)] backdrop-blur-xl">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300">
                            <span className="text-sm">✦</span>
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
                                Premium Journal
                            </p>
                            <p className="truncate text-[11px] text-zinc-600">
                                Live analytics · risk · execution
                            </p>
                        </div>
                    </div>
                    <div className="hidden items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-600 sm:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        Auto updating
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

                <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

                    <div>

                        <button
                            type="button"
                            onClick={
                                goToDashboard
                            }
                            className="mb-5 inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                        >
                            ← Back to Dashboard
                        </button>


                        <div className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                            PAL V2
                        </div>


                        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
                            Dynamic Journal
                        </h1>


                        <p className="mt-2 text-sm text-zinc-500">
                            Record and analyze your trading performance.
                        </p>

                    </div>


                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-6 py-5">

                        <div className="text-xs uppercase tracking-widest text-zinc-600">
                            Account
                        </div>


                        <div className="mt-2 font-semibold tracking-tight text-white">
                            {journal.account.name ||
                                journal.account.login}
                        </div>


                        <div className="mt-1 text-xs text-zinc-600">
                            {journal.account.server}
                        </div>

                    </div>

                </div>


                <div className="mb-8">

                    <FilterBar
                        period={period}
                        setPeriod={
                            setPeriod
                        }
                        symbol={symbol}
                        setSymbol={
                            setSymbol
                        }
                        result={result}
                        setResult={
                            setResult
                        }
                        symbolOptions={
                            symbols
                        }
                        onRefresh={() => {
                            void refetch();
                        }}
                        refreshing={
                            isFetching
                        }
                    />

                </div>


                <div className="space-y-8">

                    <section>

                        <div className="mb-4 flex items-end justify-between">

                            <div>

                                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                                    Selected View
                                </div>

                                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                                    Performance Snapshot
                                </h2>

                            </div>


                            <div className="text-right text-xs text-zinc-600">

                                <div>
                                    {
                                        filteredTrades.length
                                    }{" "}
                                    matching{" "}
                                    {
                                        filteredTrades.length ===
                                        1
                                            ? "trade"
                                            : "trades"
                                    }
                                </div>

                                <div className="mt-1">
                                    {period} day window
                                </div>

                            </div>

                        </div>


                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                            <StatCard
                                label="Balance"
                                value={formatPlainMoney(
                                    journal
                                        .account
                                        .balance,
                                )}
                            />


                            <StatCard
                                label="Equity"
                                value={formatPlainMoney(
                                    journal
                                        .account
                                        .equity,
                                )}
                            />


                            <StatCard
                                label="Filtered P&L"
                                value={formatMoney(
                                    filteredStatistics.net_profit,
                                )}
                                positive={
                                    filteredStatistics.net_profit >
                                    0
                                }
                                negative={
                                    filteredStatistics.net_profit <
                                    0
                                }
                            />


                            <StatCard
                                label="Win Rate"
                                value={`${filteredStatistics.win_rate.toFixed(
                                    2,
                                )}%`}
                                subtext={`${filteredStatistics.wins}W · ${filteredStatistics.losses}L · ${filteredStatistics.breakeven}BE`}
                            />

                        </div>

                    </section>


                    <section>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                            <StatCard
                                label="Total Trades"
                                value={String(
                                    filteredStatistics.total_trades,
                                )}
                            />


                            <StatCard
                                label="Profit Factor"
                                value={
                                    filteredStatistics.profit_factor ===
                                    null
                                        ? "—"
                                        : filteredStatistics.profit_factor.toFixed(
                                              2,
                                          )
                                }
                            />


                            <StatCard
                                label="Average Win"
                                value={formatMoney(
                                    filteredStatistics.average_win,
                                )}
                                positive={
                                    filteredStatistics.average_win >
                                    0
                                }
                            />


                            <StatCard
                                label="Average Loss"
                                value={formatMoney(
                                    filteredStatistics.average_loss,
                                )}
                                negative={
                                    filteredStatistics.average_loss <
                                    0
                                }
                            />

                        </div>

                    </section>


                    <EquityCurve
                        trades={
                            filteredTrades
                        }
                        startingBalance={
                            filteredStartingBalance
                        }
                    />


                    <DailyPerformance
                        trades={
                            filteredTrades
                        }
                    />


                    <PerformanceHeatmap
                        trades={
                            filteredTrades
                        }
                    />


                    <DayOfWeekPerformance
                        trades={
                            filteredTrades
                        }
                    />


                    <SessionPerformance
                        trades={
                            filteredTrades
                        }
                    />


                    <DrawdownAnalysis
                        trades={
                            filteredTrades
                        }
                    />


                    <TradeDurationAnalysis
                        trades={
                            filteredTrades
                        }
                    />


                    <WinLossDistribution
                        trades={
                            filteredTrades
                        }
                    />


                    <TradeQuality
                        trades={
                            filteredTrades
                        }
                    />


                    <div className="grid gap-6 lg:grid-cols-2">

                        <TradeSpotlight
                            title="Best Trade"
                            trade={
                                filteredStatistics.best_trade
                            }
                        />


                        <TradeSpotlight
                            title="Worst Trade"
                            trade={
                                filteredStatistics.worst_trade
                            }
                        />

                    </div>


                    <TradeHistory
                        trades={
                            filteredTrades
                        }
                    />


                    <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">

                        <SectionTitle
                            eyebrow="Journal Status"
                            title="Current Filter"
                            description="Everything above reflects the selected controls."
                        />


                        <div className="grid gap-4 sm:grid-cols-3">

                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">

                                <div className="text-xs uppercase tracking-wider text-zinc-600">
                                    Period
                                </div>

                                <div className="mt-2 font-semibold tracking-tight text-white">
                                    {period} Days
                                </div>

                            </div>


                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">

                                <div className="text-xs uppercase tracking-wider text-zinc-600">
                                    Symbol
                                </div>

                                <div className="mt-2 font-semibold tracking-tight text-white">
                                    {symbol ===
                                    "ALL"
                                        ? "All Symbols"
                                        : symbol}
                                </div>

                            </div>


                            <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4 shadow-inner shadow-white/[0.02]">

                                <div className="text-xs uppercase tracking-wider text-zinc-600">
                                    Result
                                </div>

                                <div className="mt-2 font-semibold tracking-tight text-white">
                                    {result ===
                                    "ALL"
                                        ? "All Results"
                                        : result}
                                </div>

                            </div>

                        </div>

                    </section>


                    <div className="mx-auto mt-2 h-px max-w-3xl bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                    <div className="pb-8 pt-4 text-center text-xs text-zinc-700">
                        PAL Trading Buddy · Journal updates automatically
                    </div>

                </div>

            </main>

        </div>
    );
}


export default JournalTest;