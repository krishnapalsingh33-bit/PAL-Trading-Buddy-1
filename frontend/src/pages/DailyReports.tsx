import { useMemo, useState } from "react";
import PalPageShell from "../components/layout/PalPageShell";
import type { Page } from "../components/layout/Sidebar";
import { usePAL } from "../hooks/usePAL";

type Props = { onPageChange: (page: Page) => void };

function itemText(value: unknown) {
    return value == null || !String(value).trim() ? "—" : String(value);
}

export default function DailyReports({ onPageChange }: Props) {
    const { data } = usePAL();
    const macro = data?.report?.macro;
    const [read, setRead] = useState(false);

    const keyPoints = useMemo(() => {
        const reasons = [
            ...(macro?.dxy?.reasons ?? []),
            ...(macro?.gbp?.reasons ?? []),
            ...(macro?.gbpusd?.reasons ?? []),
        ];
        return reasons.filter(Boolean).slice(0, 5);
    }, [macro]);

    const events = (macro?.events ?? []).slice(0, 3);

    return (
        <PalPageShell page="reports" onPageChange={onPageChange}>
            <div className="mx-auto max-w-7xl p-5 sm:p-8">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Daily Reports</p>
                    <h1 className="mt-2 text-3xl font-semibold">The macro picture, condensed.</h1>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-500">A clean daily brief built from the same PAL news, events and bias pipeline. No strategy engine is included.</p>
                </header>

                <article className="mt-6 overflow-hidden rounded-3xl border border-emerald-400/10 bg-gradient-to-br from-emerald-400/[0.07] via-zinc-950 to-zinc-950 shadow-2xl shadow-black/30">
                    <div className="border-b border-zinc-800/80 p-5 sm:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-5">
                            <div className="max-w-3xl">
                                <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-emerald-300">Daily Brief</span>
                                    <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-500">PAL Macro Intelligence</span>
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">{itemText(macro?.headline)}</h2>
                                <p className="mt-3 text-sm leading-6 text-zinc-400">{itemText(macro?.summary)}</p>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-right">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Confidence</p>
                                <p className="mt-1 text-2xl font-semibold">{macro?.confidence ?? "—"}<span className="text-sm text-zinc-600">/100</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-[1.1fr_.9fr]">
                        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/70">Key points</p>
                            <ul className="mt-4 space-y-3">
                                {(keyPoints.length ? keyPoints : ["No detailed macro reasons currently supplied."]).map((point, index) => <li key={index} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/70" />{point}</li>)}
                            </ul>
                        </section>

                        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">Bias snapshot</p>
                            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                                {[['DXY', macro?.dxy?.bias], ['GBP', macro?.gbp?.bias], ['GBP/USD', macro?.gbpusd?.bias]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900/50 px-4 py-3"><span className="text-sm text-zinc-500">{label}</span><span className="text-sm font-semibold">{itemText(value)}</span></div>)}
                            </div>
                        </section>
                    </div>

                    <div className="border-t border-amber-400/10 bg-amber-400/[0.035] p-5 sm:p-7">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/80">Main risk</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{itemText(macro?.main_risk)}</p>
                    </div>
                </article>

                <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_.8fr]">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">High-impact focus</h2><span className="text-xs text-zinc-600">{events.length} supplied</span></div>
                        <div className="mt-4 space-y-3">
                            {events.map((event, index) => <div key={index} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4"><p className="text-sm font-medium">{itemText((event as any).title ?? (event as any).name ?? (event as any).event)}</p><p className="mt-1 text-xs text-zinc-600">{itemText((event as any).currency ?? (event as any).ccy)} · {itemText((event as any).impact ?? (event as any).importance)} · {itemText((event as any).time ?? (event as any).scheduled_time ?? (event as any).datetime)}</p></div>)}
                            {!events.length && <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-600">No high-impact events currently supplied.</p>}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                        <p className="text-xs uppercase tracking-widest text-zinc-600">Read state</p>
                        <p className="mt-3 text-xl font-semibold">{read ? "READ" : "UNREAD"}</p>
                        <button type="button" onClick={() => setRead((value) => !value)} className="mt-5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-emerald-400/20 hover:text-white">{read ? "Mark as unread" : "Mark as read"}</button>
                    </div>
                </section>
            </div>
        </PalPageShell>
    );
}
