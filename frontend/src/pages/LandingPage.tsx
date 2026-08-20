import type { ReactNode } from "react";

type Props = { onEnter: () => void };

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1 text-[9px] font-semibold uppercase tracking-[.16em] text-emerald-200">{children}</span>;
}

function Feature({ eyebrow, title, body, icon }: { eyebrow: string; title: string; body: string; icon: string }) {
  return (
    <div className="group rounded-3xl border border-white/[.07] bg-white/[.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20 hover:bg-white/[.04]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] text-lg text-emerald-200">{icon}</div>
      <div className="mt-5 text-[9px] uppercase tracking-[.22em] text-emerald-300/70">{eyebrow}</div>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-zinc-500">{body}</p>
    </div>
  );
}

export default function LandingPage({ onEnter }: Props) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#020807] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[32rem] w-[32rem] rounded-full bg-emerald-400/[.08] blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10rem] top-[20rem] h-[28rem] w-[28rem] rounded-full bg-cyan-400/[.06] blur-[130px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/[.06] text-xl text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,.08)]">✦</div>
          <div><div className="text-sm font-semibold tracking-wide">PAL</div><div className="text-[9px] uppercase tracking-[.22em] text-zinc-600">Trading Buddy</div></div>
        </div>
        <button type="button" onClick={onEnter} className="rounded-xl border border-white/[.08] bg-white/[.035] px-4 py-2.5 text-[10px] font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-emerald-300/20 hover:text-white">Enter Workspace →</button>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        <section className="grid gap-10 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20">
          <div>
            <div className="flex flex-wrap gap-2"><Pill>Evidence first</Pill><Pill>Macro aware</Pill><Pill>MT5 journal</Pill></div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">Your trading desk,<br /><span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-white bg-clip-text text-transparent">with an AI beside you.</span></h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base">PAL Trading Buddy turns live market evidence, macro context and your MT5 history into one calm workspace built to help you think clearly and execute your own plan.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={onEnter} className="rounded-2xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#03110c] shadow-[0_15px_40px_rgba(52,211,153,.16)] transition hover:-translate-y-0.5">Enter PAL Workspace</button>
              <span className="rounded-2xl border border-white/[.07] bg-white/[.02] px-5 py-3 text-xs text-zinc-500">Private · evidence-first · no invented conviction</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border border-emerald-300/15 bg-[#071311]/95 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
              <div className="absolute inset-8 rounded-[2rem] border border-white/[.06] bg-[radial-gradient(circle_at_50%_35%,rgba(61,220,151,.18),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,.10),transparent_42%)]" />
              <div className="absolute left-1/2 top-[28%] h-32 w-32 -translate-x-1/2 rounded-full border border-emerald-200/25 bg-emerald-300/[.07] shadow-[0_0_100px_rgba(52,211,153,.18)] animate-pulse" />
              <div className="absolute left-1/2 top-[33%] flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-200/[.08] text-3xl text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,.18)]">✦</div>
              <div className="absolute inset-x-8 bottom-8 rounded-2xl border border-white/[.06] bg-black/35 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.2em] text-zinc-600">PAL intelligence</span><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[8px] font-bold text-emerald-300">LIVE</span></div>
                <p className="mt-3 text-xs leading-5 text-zinc-300">“I’ll separate today’s evidence from the broader regime before giving you a view.”</p>
                <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2"><div className="text-[8px] text-zinc-600">DXY</div><div className="mt-1 text-[10px] text-amber-300">NEUTRAL</div></div><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2"><div className="text-[8px] text-zinc-600">GBP</div><div className="mt-1 text-[10px] text-emerald-300">BULLISH</div></div><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2"><div className="text-[8px] text-zinc-600">GBP/USD</div><div className="mt-1 text-[10px] text-emerald-300">BULLISH</div></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[.06] py-16">
          <div className="max-w-2xl"><div className="text-[9px] uppercase tracking-[.24em] text-cyan-300">Why PAL exists</div><h2 className="mt-3 text-3xl font-semibold text-white">Less noise. More evidence. Better decisions.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Trading often becomes harder because information is scattered across charts, news, calendars and journals. PAL brings those layers together without pretending uncertainty does not exist.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Feature eyebrow="Today" title="Live bias" body="Keep the current trading-day evidence separate from the longer-term macro regime." icon="⌁" />
            <Feature eyebrow="Macro" title="Macro desk" body="See DXY, GBP and GBP/USD regime context with explicit evidence rather than generic commentary." icon="◈" />
            <Feature eyebrow="AI" title="PAL Intelligence" body="Ask natural-language questions about the evidence on your dashboard or your trading journal." icon="✦" />
            <Feature eyebrow="Journal" title="MT5 history" body="Connect a local MetaTrader 5 terminal and turn executed trades into a professional performance journal." icon="▣" />
          </div>
        </section>

        <section className="grid gap-6 border-t border-white/[.06] py-16 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-7"><div className="text-[9px] uppercase tracking-[.22em] text-emerald-300">How PAL thinks</div><div className="mt-5 space-y-4 text-sm"><div><span className="font-semibold text-white">01 · Read today</span><p className="mt-1 text-xs leading-5 text-zinc-500">Current-day news, releases and market evidence come first.</p></div><div><span className="font-semibold text-white">02 · Read the regime</span><p className="mt-1 text-xs leading-5 text-zinc-500">Broader macro stays in its own layer so it does not silently override today’s evidence.</p></div><div><span className="font-semibold text-white">03 · Say what is known</span><p className="mt-1 text-xs leading-5 text-zinc-500">Unknown stays unknown. Missing evidence is surfaced instead of filled with guesses.</p></div></div></div>
          <div className="rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[.07] to-cyan-300/[.03] p-7"><div className="text-[9px] uppercase tracking-[.22em] text-cyan-300">Built for traders</div><h3 className="mt-3 text-2xl font-semibold text-white">PAL is not here to replace your process.</h3><p className="mt-3 text-sm leading-6 text-zinc-500">It is here to organize the information around it, challenge weak assumptions and make your review process faster.</p><button type="button" onClick={onEnter} className="mt-6 rounded-xl border border-white/[.09] bg-black/20 px-4 py-3 text-xs font-semibold text-white hover:border-emerald-300/20">Open PAL →</button></div>
        </section>

        <footer className="border-t border-white/[.06] pt-8 text-center text-[9px] uppercase tracking-[.18em] text-zinc-700">PAL Trading Buddy · Evidence before conviction</footer>
      </main>
    </div>
  );
}
