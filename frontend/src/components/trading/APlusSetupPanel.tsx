import { useEffect, useMemo, useState } from "react";
import { usePAL } from "../../hooks/usePAL";

type CheckState = "pending" | "confirmed" | "failed";

type Rule = {
  id: string;
  title: string;
  description: string;
  why: string;
};

const RULES: Rule[] = [
  {
    id: "liquidity",
    title: "1 · External → Internal Liquidity",
    description: "External buy-side or sell-side is taken before the internal entry-side liquidity is taken.",
    why: "This is the start of your model. No external take = no model.",
  },
  {
    id: "dxy",
    title: "2 · DXY Alignment",
    description: "DXY has delivered the required opposite-side liquidity relationship for the selected forex setup.",
    why: "PAL uses this as a correlation filter, not as a standalone entry signal.",
  },
  {
    id: "cisd",
    title: "3 · CISD / Real Displacement",
    description: "A valid delivery shift is confirmed by a close; displacement has clear intent and imbalance.",
    why: "No close confirmation = no entry. A wick alone is not displacement.",
  },
  {
    id: "pd",
    title: "4 · Discount / Premium",
    description: "The planned entry is in the correct premium/discount location for the intended direction.",
    why: "Location protects the model from chasing price after displacement.",
  },
  {
    id: "target",
    title: "5 · Target + Why",
    description: "The objective is defined before entry and the reason for targeting it is explicit.",
    why: "An A++ trade must know what it is reaching for before the trigger is taken.",
  },
];

const DEFAULT_STATES: Record<string, CheckState> = Object.fromEntries(RULES.map((rule) => [rule.id, "pending"])) as Record<string, CheckState>;

function storageKey() {
  const day = new Date().toISOString().slice(0, 10);
  return `pal-a-plus-checklist-${day}`;
}

function normalizeBias(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("BULL")) return "BULLISH";
  if (text.includes("BEAR")) return "BEARISH";
  if (text.includes("NEUTRAL")) return "NEUTRAL";
  return "UNKNOWN";
}

function stateClass(state: CheckState) {
  if (state === "confirmed") return "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300";
  if (state === "failed") return "border-red-300/20 bg-red-300/[.07] text-red-300";
  return "border-white/[.07] bg-black/20 text-zinc-500";
}

function stateLabel(state: CheckState) {
  if (state === "confirmed") return "CONFIRMED";
  if (state === "failed") return "FAILED";
  return "PENDING";
}

export default function APlusSetupPanel() {
  const { data } = usePAL();
  const [states, setStates] = useState<Record<string, CheckState>>(DEFAULT_STATES);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey());
      if (saved) setStates({ ...DEFAULT_STATES, ...JSON.parse(saved) });
    } catch {
      setStates(DEFAULT_STATES);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey(), JSON.stringify(states));
  }, [states]);

  const confirmed = RULES.filter((rule) => states[rule.id] === "confirmed").length;
  const failed = RULES.filter((rule) => states[rule.id] === "failed").length;
  const unlocked = confirmed === RULES.length;
  const today = data?.report?.today?.today ?? data?.report?.today ?? {};
  const gbpusdBias = normalizeBias(today?.gbpusd?.bias);
  const dxyBias = normalizeBias(today?.dxy?.bias);

  const summary = useMemo(() => {
    if (failed > 0) return "BLOCKED · A rule is explicitly failed.";
    if (unlocked) return "A++ · ALL FIVE RULES CONFIRMED";
    return `${confirmed}/5 confirmed · WAIT FOR THE REST`;
  }, [confirmed, failed, unlocked]);

  const cycle = (id: string) => {
    setStates((current) => {
      const state = current[id] ?? "pending";
      const next: Record<CheckState, CheckState> = { pending: "confirmed", confirmed: "failed", failed: "pending" };
      return { ...current, [id]: next[state] };
    });
  };

  const reset = () => setStates(DEFAULT_STATES);

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-300/15 bg-[#07100f]/95 shadow-[0_24px_90px_rgba(0,0,0,.55)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.22em] text-emerald-300">A++ SETUP ENGINE</div>
          <div className="mt-1 text-xs font-semibold text-white">Your 5-rule execution gate</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="rounded-lg border border-white/[.07] px-2 py-1 text-[8px] uppercase tracking-wider text-zinc-500 hover:text-white">Reset</button>
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-white/[.07] px-2 py-1 text-[9px] text-zinc-400 hover:text-white">{open ? "−" : "+"}</button>
        </div>
      </div>

      {open ? (
        <div className="p-4">
          <div className={`rounded-xl border p-3 ${unlocked ? "border-emerald-300/25 bg-emerald-300/[.08]" : failed ? "border-red-300/20 bg-red-300/[.05]" : "border-amber-300/15 bg-amber-300/[.035]"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-bold uppercase tracking-[.16em] text-zinc-300">{summary}</span>
              <span className={`font-mono text-sm font-bold ${unlocked ? "text-emerald-300" : failed ? "text-red-300" : "text-amber-300"}`}>{confirmed}/5</span>
            </div>
            <div className="mt-2 text-[9px] leading-4 text-zinc-500">Today · GBP/USD {gbpusdBias} · DXY {dxyBias}</div>
          </div>

          <div className="mt-3 space-y-2">
            {RULES.map((rule) => {
              const state = states[rule.id] ?? "pending";
              return (
                <button key={rule.id} type="button" onClick={() => cycle(rule.id)} className={`w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${stateClass(state)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-white">{rule.title}</div>
                      <div className="mt-1 text-[9px] leading-4 text-zinc-500">{rule.description}</div>
                    </div>
                    <span className="shrink-0 rounded-lg border border-current/20 px-2 py-1 text-[8px] font-bold tracking-wider">{stateLabel(state)}</span>
                  </div>
                  <div className="mt-2 text-[8px] leading-4 text-zinc-600">{rule.why}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-white/[.06] bg-black/20 p-3 text-[8px] leading-4 text-zinc-600">
            Click a rule to cycle <span className="text-zinc-400">Pending → Confirmed → Failed</span>. PAL never marks a rule confirmed from missing evidence; confirmation is your execution decision.
          </div>
        </div>
      ) : null}
    </section>
  );
}
