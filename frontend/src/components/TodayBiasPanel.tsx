import React, { useState } from "react";

type Session = {
  active?: boolean;
  bias?: string;
  score?: number;
  confidence?: number;
  reasons?: string[];
};

export default function TodayBiasPanel({ todayBias, macroBias }: { todayBias: any; macroBias?: any }) {
  const [showMacro, setShowMacro] = useState(false);
  const today = todayBias?.today ?? {};
  const sessions: Record<string, Session> = todayBias?.sessions ?? {};
  const active = todayBias?.active_session;
  const tone = (bias: string) => {
    const b = String(bias ?? "UNKNOWN").toUpperCase();
    if (b === "BULLISH") return "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300";
    if (b === "BEARISH") return "border-red-400/25 bg-red-400/[0.08] text-red-300";
    return "border-amber-400/20 bg-amber-400/[0.06] text-amber-300";
  };
  const bias = String(today.bias ?? "UNKNOWN").toUpperCase();
  const dxy = String(macroBias?.dxy?.bias ?? "UNKNOWN").toUpperCase();
  const gbp = String(macroBias?.gbp?.bias ?? "UNKNOWN").toUpperCase();
  const gbpusd = String(macroBias?.gbpusd?.bias ?? "UNKNOWN").toUpperCase();

  return (
    <>
      <section className="relative mt-5 overflow-hidden rounded-3xl border border-cyan-300/10 bg-gradient-to-br from-cyan-400/[0.055] via-white/[0.018] to-emerald-400/[0.045] p-5 shadow-[0_24px_90px_-55px_rgba(34,211,238,0.5)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 animate-pulse rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Today's Directional Layer</div>
            <h2 className="mt-2 text-xl font-semibold text-white">TODAY'S MARKET BIAS</h2>
          </div>
          <button onClick={() => setShowMacro((value) => !value)} className="rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-cyan-300/20 hover:text-cyan-300">
            {showMacro ? "Hide macro bias" : "Show macro bias"}
          </button>
        </div>

        <div className="relative mt-4 grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">GBP/USD · TODAY ONLY</div>
            <div className={`mt-4 inline-flex rounded-xl border px-3 py-2 text-sm font-bold tracking-wider ${tone(bias)}`}>{bias}</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${bias === "BULLISH" ? "bg-emerald-300" : bias === "BEARISH" ? "bg-red-300" : "bg-amber-300"}`} style={{ width: `${Math.min(100, Number(today.confidence ?? 0))}%` }} /></div>
              <span className="text-[10px] text-zinc-500">{Number(today.confidence ?? 0)}%</span>
            </div>
            <div className="mt-3 text-[9px] uppercase tracking-wider text-zinc-600">Recalculated from today's evidence</div>
          </div>

          {(["Asia", "London", "New York"] as const).map((name) => {
            const item = sessions[name] ?? {};
            const itemBias = String(item.bias ?? "UNKNOWN").toUpperCase();
            const isActive = Boolean(item.active) || active === name;
            return (
              <div key={name} className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${isActive ? "border-cyan-300/20 bg-cyan-300/[0.045] shadow-[0_0_35px_-20px_rgba(34,211,238,0.9)]" : "border-white/[0.07] bg-black/20"}`}>
                {isActive && <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-cyan-300/60" />}
                <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{name}</span><span className={`text-[8px] font-bold uppercase tracking-wider ${isActive ? "text-emerald-300" : "text-zinc-700"}`}>{isActive ? "LIVE NOW" : "STANDBY"}</span></div>
                <div className={`mt-5 inline-flex rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wider ${tone(itemBias)}`}>{itemBias}</div>
                <div className="mt-3 text-[10px] text-zinc-600">{Number(item.confidence ?? 0)}% confidence · score {Number(item.score ?? 0).toFixed(1)}</div>
                <p className="mt-3 line-clamp-3 text-[10px] leading-4 text-zinc-500">{item.reasons?.[0] ?? `Waiting for ${name} session evidence.`}</p>
              </div>
            );
          })}
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3 text-[9px] uppercase tracking-wider text-zinc-600">
          <span className="rounded-md border border-white/[0.05] px-2 py-1">Macro filter only</span>
          <span className="rounded-md border border-white/[0.05] px-2 py-1">No entry signal</span>
          <span className="rounded-md border border-white/[0.05] px-2 py-1">Wait for your technical model</span>
        </div>
      </section>

      {showMacro && (
        <section className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Underlying Macro Bias</div>
              <div className="mt-1 text-xs text-zinc-500">Broader news-derived macro layer · separate from today's directional bias</div>
            </div>
            <button onClick={() => setShowMacro(false)} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[9px] uppercase tracking-wider text-zinc-500 hover:text-white">Hide</button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {[['DXY', dxy], ['GBP', gbp], ['GBP/USD', gbpusd]].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{String(label)}</span>
                <span className={`rounded-lg border px-2 py-1 text-[9px] font-semibold ${tone(String(value))}`}>{String(value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
