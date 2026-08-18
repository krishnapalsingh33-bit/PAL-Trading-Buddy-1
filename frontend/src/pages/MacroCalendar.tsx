import { useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };
type EventItem = Record<string, unknown>;

type Range = "TODAY" | "TOMORROW" | "ALL";

function text(event: EventItem, keys: string[]) {
    for (const key of keys) {
        const value = event[key];
        if (value !== undefined && value !== null && String(value).trim()) return String(value);
    }
    return "—";
}

function eventDate(event: EventItem) {
    const raw = text(event, ["time", "scheduled_time", "datetime", "date"]);
    if (raw === "—") return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesRange(event: EventItem, range: Range) {
    if (range === "ALL") return true;
    const date = eventDate(event);
    if (!date) return range === "ALL";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + (range === "TODAY" ? 1 : 2));
    if (range === "TOMORROW") start.setDate(start.getDate() + 1);
    return date >= start && date < end;
}

function impactClass(value: string) {
    const impact = value.toUpperCase();
    if (impact.includes("HIGH")) return "border-red-400/20 bg-red-400/5 text-red-300";
    if (impact.includes("MEDIUM")) return "border-amber-400/20 bg-amber-400/5 text-amber-300";
    return "border-zinc-800 bg-zinc-900/50 text-zinc-500";
}

export default function MacroCalendar({ onPageChange }: Props) {
    const { data } = usePAL();
    const [currency, setCurrency] = useState("ALL");
    const [impact, setImpact] = useState("ALL");
    const [range, setRange] = useState<Range>("TODAY");

    const events = useMemo(() => {
        const raw = [...(data?.report?.news?.upcoming_events ?? []), ...(data?.report?.news?.recent_events ?? [])] as EventItem[];
        const seen = new Set<string>();
        return raw.filter((event) => {
            const title = text(event, ["title", "name", "event"]);
            const time = text(event, ["time", "scheduled_time", "datetime", "date"]);
            const eventCurrency = text(event, ["currency", "ccy"]).toUpperCase();
            const eventImpact = text(event, ["impact", "importance"]).toUpperCase();
            const key = `${title}|${time}|${eventCurrency}|${eventImpact}`;
            if (seen.has(key)) return false;
            seen.add(key);
            if (currency !== "ALL" && eventCurrency !== currency) return false;
            if (impact !== "ALL" && !eventImpact.includes(impact)) return false;
            return matchesRange(event, range);
        });
    }, [data, currency, impact, range]);

    return (
        <PalPageShell page="macro-calendar" onPageChange={onPageChange}>
            <div className="mx-auto max-w-7xl p-5 sm:p-8">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Macro Calendar</p>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                        <div><h1 className="text-3xl font-semibold">What Matters Next</h1><p className="mt-2 text-sm text-zinc-500">Market-moving events and macro context from the existing PAL feed.</p></div>
                        <div className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400">Provider data only · no invented values</div>
                    </div>
                </header>

                <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-wrap gap-2">
                        {(["TODAY", "TOMORROW", "ALL"] as const).map((item) => <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-lg border px-3 py-1.5 text-xs ${range === item ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-zinc-800 text-zinc-500"}`}>{item}</button>)}
                        <div className="mx-1 hidden w-px bg-zinc-800 sm:block" />
                        {(["ALL", "USD", "GBP", "EUR", "JPY"] as const).map((item) => <button key={item} type="button" onClick={() => setCurrency(item)} className={`rounded-lg border px-3 py-1.5 text-xs ${currency === item ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-zinc-800 text-zinc-500"}`}>{item}</button>)}
                        <div className="mx-1 hidden w-px bg-zinc-800 sm:block" />
                        {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((item) => <button key={item} type="button" onClick={() => setImpact(item)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === item ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-zinc-800 text-zinc-500"}`}>{item}</button>)}
                    </div>
                </section>

                <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Event stream</h2><span className="text-xs text-zinc-600">{events.length} supplied items</span></div>
                    <div className="space-y-3">
                        {events.map((event, index) => {
                            const title = text(event, ["title", "name", "event"]);
                            const eventCurrency = text(event, ["currency", "ccy"]);
                            const eventImpact = text(event, ["impact", "importance"]);
                            const time = text(event, ["time", "scheduled_time", "datetime", "date"]);
                            const actual = text(event, ["actual"]);
                            const forecast = text(event, ["forecast"]);
                            const previous = text(event, ["previous"]);
                            return <article key={`${title}-${index}`} className="rounded-xl border border-zinc-900 bg-zinc-900/35 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-widest text-zinc-600">{time}</p><h3 className="mt-1 text-base font-semibold">{title}</h3></div><div className="flex gap-2"><span className="rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-400">{eventCurrency}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${impactClass(eventImpact)}`}>{eventImpact}</span></div></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-zinc-950/70 p-3"><p className="text-[10px] uppercase tracking-widest text-zinc-600">Actual</p><p className="mt-1 text-sm text-zinc-300">{actual}</p></div><div className="rounded-lg bg-zinc-950/70 p-3"><p className="text-[10px] uppercase tracking-widest text-zinc-600">Forecast</p><p className="mt-1 text-sm text-zinc-300">{forecast}</p></div><div className="rounded-lg bg-zinc-950/70 p-3"><p className="text-[10px] uppercase tracking-widest text-zinc-600">Previous</p><p className="mt-1 text-sm text-zinc-300">{previous}</p></div></div></article>;
                        })}
                        {!events.length && <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center"><p className="text-sm text-zinc-400">No events currently supplied for these filters.</p><p className="mt-2 text-xs text-zinc-600">PAL will not invent calendar values when the provider is unavailable.</p></div>}
                    </div>
                </section>
            </div>
        </PalPageShell>
    );
}
