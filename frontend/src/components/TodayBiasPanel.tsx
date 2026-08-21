import React from "react";

type Session = {
  active?: boolean;
  bias?: string;
  score?: number;
  confidence?: number;
  reasons?: string[];
};

type RightNow = {
  bias?: string;
  momentum?: number | null;
  direction?: string;
};

export default function TodayBiasPanel({ todayBias }: { todayBias: any }) {
  const today = todayBias?.today ?? {};
  const sessions: Record<string, Session> = todayBias?.sessions ?? {};
  const active = todayBias?.active_session;
  const rightNow: Record<string, RightNow> = today?.right_now ?? {};

  const tone = (bias: string) => {
    const b = String(bias ?? "UNKNOWN").toUpperCase();
    if (b === "BULLISH") return "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300";
    if (b === "BEARISH") return "border-red-400/25 bg-red-400/[0.08] text-red-300";
    return "border-amber-400/20 bg-amber-400/[0.06] text-amber-300";
  };

  const momentumTone = (direction: string) => {
    const value = String(direction ?? "").toUpperCase();
    if (value.includes("BUY")) return "text-emerald-300";
    if (value.includes("SELL")) return "text-red-300";
    return "text-zinc-500";
  };

  const bias = String(today.bias ?? "UNKNOWN").toUpperCase();

  const instruments = [
    ["DXY", rightNow.dxy],
    ["GBP", rightNow.gbp],
    ["GBP/USD", rightNow.gbpusd],
  ] as const;

  return (
    <section className="relative mt-5 overflow-hidden rounded-3xl border border-cyan-300/10 bg-gradient-to-br from-cyan-400/[0.055] via-white/[0.018] to-emerald-400/[0.045] p-5 shadow-[0_24px_90px_-55px_rgba(34,211,238,0.5)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 animate-pulse rounded-full bg-cyan-300/[0.07] blur-3xl" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-stretch">
        <div className="min-w-[270px] flex-1 rounded-2xl border border-white/[0.07] bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Current-Day Context</div>
              <h2 className="mt-2 text-xl font-semibold text-white">TODAY'S GBP/USD BIAS</h2>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-xs font-bold tracking-wider ${tone(bias)}`}>{bias}</div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-current opacity-70 transition-all duration-700" style={{ width: `${Math.min(100, Number(today.confidence ?? 0))}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500">{Number(today.confidence ?? 0)}% confidence</span>
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-wider text-zinc-600">Scope: today only · news, releases and current-day evidence</p>
          <div className="mt-4 space-y-2">
            {(today.reasons ?? []).slice(0, 4).map((reason: string, index: number) => (
              <div key={`${reason}-${index}`} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[10px] leading-4 text-zinc-400">{reason}</div>
            ))}
            {!(today.reasons ?? []).length && <div className="text-xs text-zinc-600">No fresh directional evidence is available yet.</div>}
          </div>
        </div>

        <div className="flex-[1.35]">
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-300">RIGHT NOW</span>
                </div>
                <div className="mt-1 text-[10px] text-zinc-600">Immediate price/momentum state · not a timeframe analysis</div>
              </div>
              <span className="text-[8px] uppercase tracking-wider text-zinc-700">LIVE OBSERVATION</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {instruments.map(([name, item]) => {
                const itemBias = String(item?.bias ?? "UNKNOWN").toUpperCase();
                const direction = String(item?.direction ?? "NO LIVE MOMENTUM").toUpperCase();
                const momentum = item?.momentum;
                return (
                  <div key={name} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{name}</span>
                      <span className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${tone(itemBias)}`}>{itemBias}</span>
                    </div>
                    <div className={`mt-4 text-sm font-bold tracking-wider ${momentumTone(direction)}`}>{direction}</div>
                    <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-600">
                      <span>Momentum</span>
                      <span className="font-mono">{typeof momentum === "number" ? `${momentum >= 0 ? "+" : ""}${momentum.toFixed(3)}%` : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["Asia", "London", "New York"] as const).map((name) => {
              const item = sessions[name] ?? {};
              const itemBias = String(item.bias ?? "UNKNOWN").toUpperCase();
              const isActive = Boolean(item.active) || active === name;
              return (
                <div key={name} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 hover:-translate-y-0.5 ${isActive ? "border-cyan-300/20 bg-cyan-300/[0.045] shadow-[0_0_35px_-20px_rgba(34,211,238,0.9)]" : "border-white/[0.07] bg-black/20"}`}>
                  {isActive && <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-cyan-300/60" />}
                  <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{name}</span><span className={`text-[8px] font-bold uppercase tracking-wider ${isActive ? "text-emerald-300" : "text-zinc-700"}`}>{isActive ? "LIVE NOW" : "STANDBY"}</span></div>
                  <div className={`mt-5 inline-flex rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wider ${tone(itemBias)}`}>{itemBias}</div>
                  <div className="mt-3 text-[10px] text-zinc-600">{Number(item.confidence ?? 0)}% confidence · score {Number(item.score ?? 0).toFixed(1)}</div>
                  <p className="mt-3 line-clamp-3 text-[10px] leading-4 text-zinc-500">{item.reasons?.[0] ?? `Waiting for ${name} session evidence.`}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3 text-[9px] uppercase tracking-wider text-zinc-600">
        <span className="rounded-md border border-white/[0.05] px-2 py-1">Today = context</span>
        <span className="rounded-md border border-white/[0.05] px-2 py-1">Right Now = immediate price state</span>
        <span className="rounded-md border border-white/[0.05] px-2 py-1">No timeframe labels</span>
      </div>
    </section>
  );
}
