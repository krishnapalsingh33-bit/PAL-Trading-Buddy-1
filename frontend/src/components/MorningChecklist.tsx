import { useEffect, useMemo, useState } from "react";
import { usePAL } from "../hooks/usePAL";

type Item = { id: string; label: string; done: boolean };
type SavedState = { items: Item[]; completedAt?: string | null };

const DEFAULT: Item[] = [
  { id: "dxy", label: "DXY direction checked", done: false },
  { id: "news", label: "Today's news checked", done: false },
  { id: "london", label: "London session checked", done: false },
  { id: "newyork", label: "New York session checked", done: false },
  { id: "sync", label: "Market sync checked", done: false },
];

function keyForToday() { return `pal-morning-checklist-${new Date().toISOString().slice(0, 10)}`; }
function bias(value: unknown) { const raw = String(value ?? "").toUpperCase(); if (raw.includes("BULL")) return "BULLISH"; if (raw.includes("BEAR")) return "BEARISH"; if (raw.includes("WARM")) return "WARMING UP"; if (raw === "NEUTRAL") return "NEUTRAL"; return "UNKNOWN"; }

export default function MorningChecklist() {
  const { data } = usePAL();
  const [items, setItems] = useState<Item[]>(DEFAULT);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(keyForToday());
      if (!raw) { setItems(DEFAULT); setCompletedAt(null); return; }
      const saved = JSON.parse(raw) as SavedState | Item[];
      const savedItems = Array.isArray(saved) ? saved : saved.items ?? [];
      const savedMap = new Map(savedItems.map((item) => [item.id, Boolean(item.done)]));
      const migrated = DEFAULT.map((item) => ({ ...item, done: savedMap.get(item.id) ?? false }));
      setItems(migrated);
      if (!Array.isArray(saved) && saved.completedAt) setCompletedAt(saved.completedAt);
      else if (migrated.every((item) => item.done)) setCompletedAt(new Date().toISOString());
    } catch {
      setItems(DEFAULT);
      setCompletedAt(null);
    }
  }, []);

  const complete = items.every((item) => item.done);
  useEffect(() => {
    const timestamp = complete ? completedAt ?? new Date().toISOString() : null;
    if (timestamp !== completedAt) setCompletedAt(timestamp);
    window.localStorage.setItem(keyForToday(), JSON.stringify({ items, completedAt: timestamp } satisfies SavedState));
  }, [items, complete, completedAt]);

  const today = data?.report?.today?.today ?? {};
  const rightNow = today?.right_now ?? {};
  const completed = items.filter((item) => item.done).length;
  const timestamp = useMemo(() => completedAt ? new Date(completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null, [completedAt]);

  const toggle = (id: string) => {
    if (complete) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  };

  // Completed routines are intentionally removed from the sidebar for the remainder of the day.
  if (complete) return null;

  return (
    <div className="mx-1 mb-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.025] p-3">
      <div className="flex items-center justify-between gap-2">
        <div><div className="text-[8px] font-bold uppercase tracking-[.2em] text-cyan-300">Morning routine</div><div className="mt-1 text-[10px] font-semibold text-white">5-step market check</div></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-white/[.06] px-2 py-1 text-[8px] text-zinc-500">{open ? "−" : "+"}</button>
      </div>
      {open && <>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[8px]"><div className="rounded-lg border border-white/[.05] bg-black/20 p-2"><span className="text-zinc-600">DXY</span><div className="mt-1 font-semibold text-zinc-300">{bias(rightNow.dxy?.bias)}</div></div><div className="rounded-lg border border-white/[.05] bg-black/20 p-2"><span className="text-zinc-600">GBP/USD</span><div className="mt-1 font-semibold text-zinc-300">{bias(rightNow.gbpusd?.bias)}</div></div></div>
        <div className="mt-3 space-y-1.5">{items.map((item) => <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-2 rounded-lg border border-white/[.05] bg-black/15 px-2 py-1.5 text-left"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${item.done ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : "border-white/[.10] text-transparent"}`}>✓</span><span className={`text-[8px] ${item.done ? "text-zinc-400 line-through" : "text-zinc-500"}`}>{item.label}</span></button>)}</div>
        <div className="mt-3 rounded-lg border border-white/[.06] bg-black/15 px-2 py-2 text-center text-[8px] font-bold uppercase tracking-wider text-zinc-600">{completed}/5 checks complete</div>
      </>}
      {complete ? <span className="hidden">{timestamp}</span> : null}
    </div>
  );
}
