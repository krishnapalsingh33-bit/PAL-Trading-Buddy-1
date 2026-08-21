import { useEffect, useMemo, useState } from "react";
import { usePAL } from "../../hooks/usePAL";

type State = "pending" | "confirmed" | "failed";

type Gate = {
  id: string;
  title: string;
  detail: string;
};

const GATES: Gate[] = [
  {
    id: "dxy_sweep",
    title: "DXY external liquidity taken",
    detail: "Confirm the DXY-side external buy-side or sell-side liquidity event that starts your model.",
  },
  {
    id: "pair_sweep",
    title: "GBP/USD opposite-side liquidity taken",
    detail: "Confirm GBP/USD has taken the corresponding opposite-side liquidity. No entry before this condition.",
  },
  {
    id: "cisd",
    title: "3M CISD close confirmed",
    detail: "Confirm the delivery shift with a close. A wick or incomplete candle does not qualify.",
  },
];

const DEFAULT: Record<string, State> = Object.fromEntries(GATES.map((gate) => [gate.id, "pending"])) as Record<string, State>;

function todayKey() {
  return `pal-dxy-correlation-${new Date().toISOString().slice(0, 10)}`;
}

function bias(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("BULL")) return "BULLISH";
  if (text.includes("BEAR")) return "BEARISH";
  if (text.includes("NEUTRAL")) return "NEUTRAL";
  return "UNKNOWN";
}

function tone(value: string) {
  if (value === "BULLISH") return "text-emerald-300 border-emerald-300/20 bg-emerald-300/[.07]";
  if (value === "BEARISH") return "text-red-300 border-red-300/20 bg-red-300/[.07]";
  if (value === "NEUTRAL") return "text-amber-300 border-amber-300/20 bg-amber-300/[.07]";
  return "text-zinc-500 border-white/[.07] bg-black/20";
}

function stateTone(state: State) {
  if (state === "confirmed") return "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-300";
  if (state === "failed") return "border-red-300/20 bg-red-300/[.06] text-red-300";
  return "border-white/[.07] bg-black/20 text-zinc-500";
}

export default function DxyCorrelationPanel() {
  const { data } = usePAL();
  const [expanded, setExpanded] = useState(true);
  const [states, setStates] = useState<Record<string, State>>(DEFAULT);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(todayKey());
      if (saved) setStates({ ...DEFAULT, ...JSON.parse(saved) });
    } catch {
      setStates(DEFAULT);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(todayKey(), JSON.stringify(states));
  }, [states]);

  const today = data?.report?.today?.today ?? data?.report?.today ?? {};
  const dxyBias = bias(today?.dxy?.bias);
  const pairBias = bias(today?.gbpusd?.bias);
  const confirmed = GATES.filter((gate) => states[gate.id] === "confirmed").length;
  const failed = GATES.some((gate) => states[gate.id] === "failed");

  const correlation = useMemo(() => {
    if (dxyBias === "UNKNOWN" || pairBias === "UNKNOWN") return "UNKNOWN";
    if (dxyBias === "BULLISH" && pairBias === "BEARISH") return "ALIGNED · USD↑ / GBPUSD↓";
    if (dxyBias === "BEARISH" && pairBias === "BULLISH") return "ALIGNED · USD↓ / GBPUSD↑";
    return "CONFLICT · WAIT";
  }, [dxyBias, pairBias]);

  const verdict = failed
    ? "BLOCKED"
    : confirmed === GATES.length && correlation.startsWith("ALIGNED")
      ? "EXECUTION WINDOW"
      : correlation === "UNKNOWN"
        ? "WAIT · MISSING DATA"
        : correlation.startsWith("CONFLICT")
          ? "WAIT · CORRELATION CONFLICT"
          : "WAIT · LIQUIDITY / CISD";

  const cycle = (id: string) => {
    setStates((current) => {
      const next: Record<State, State> = { pending: "confirmed", confirmed: "failed", failed: "pending" };
      return { ...current, [id]: next[current[id] ?? "pending"] };
    });
  };

  const reset = () => setStates(DEFAULT);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/12 bg-[#071014]/95 shadow-[0_24px_90px_rgba(0,0,0,.45)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">DXY CORRELATION ENGINE</div>
          <div className="mt-1 text-xs font-semibold text-white">Your execution correlation gate</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="rounded-lg border border-white/[.07] px-2 py-1 text-[8px] uppercase tracking-wider text-zinc-500 hover:text-white">Reset</button>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="rounded-lg border border-white/[.07] px-2 py-1 text-[9px] text-zinc-400 hover:text-white">{expanded ? "−" : "+"}</button>
        </div>
      </div>

      {expanded ? (
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">DXY today</div><div className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${tone(dxyBias)}`}>{dxyBias}</div></div>
            <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">GBP/USD today</div><div className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-bold ${tone(pairBias)}`}>{pairBias}</div></div>
            <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Correlation</div><div className={`mt-2 text-[10px] font-bold ${correlation.startsWith("ALIGNED") ? "text-emerald-300" : correlation.startsWith("CONFLICT") ? "text-red-300" : "text-zinc-500"}`}>{correlation}</div></div>
          </div>

          <div className={`mt-3 rounded-xl border p-3 ${verdict === "EXECUTION WINDOW" ? "border-emerald-300/25 bg-emerald-300/[.08]" : verdict === "BLOCKED" ? "border-red-300/25 bg-red-300/[.06]" : "border-amber-300/15 bg-amber-300/[.035]"}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-bold uppercase tracking-[.16em] text-zinc-300">{verdict}</span><span className="font-mono text-sm font-bold text-zinc-300">{confirmed}/3</span></div>
            <p className="mt-1 text-[8px] leading-4 text-zinc-600">The engine never infers a liquidity sweep or CISD from bias alone. Confirm those events from your chart.</p>
          </div>

          <div className="mt-3 space-y-2">
            {GATES.map((gate) => {
              const state = states[gate.id] ?? "pending";
              return <button type="button" key={gate.id} onClick={() => cycle(gate.id)} className={`w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${stateTone(state)}`}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold text-white">{gate.title}</div><div className="mt-1 text-[8px] leading-4 text-zinc-600">{gate.detail}</div></div><span className="shrink-0 rounded-lg border border-current/20 px-2 py-1 text-[8px] font-bold">{state.toUpperCase()}</span></div></button>;
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
