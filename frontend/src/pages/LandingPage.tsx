import type { ReactNode } from "react";

type Props = { onEnter: () => void };

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.05] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.16em] text-emerald-200">
      {children}
    </span>
  );
}

function Feature({ eyebrow, title, body, icon }: { eyebrow: string; title: string; body: string; icon: string }) {
  return (
    <div className="group rounded-3xl border border-white/[.07] bg-white/[.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20 hover:bg-white/[.04]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] text-lg text-emerald-200 transition duration-300 group-hover:scale-105 group-hover:rotate-3">
        {icon}
      </div>
      <div className="mt-5 text-[9px] uppercase tracking-[.22em] text-emerald-300/70">{eyebrow}</div>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-zinc-500">{body}</p>
    </div>
  );
}

function MiniStat({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4">
      <div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function LandingPage({ onEnter }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020807] text-zinc-100 selection:bg-emerald-300/20">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[38rem] w-[38rem] rounded-full bg-emerald-400/[.08] blur-[130px]" />
      <div className="pointer-events-none absolute right-[-12rem] top-[18rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/[.06] blur-[140px]" />
      <div className="pointer-events-none absolute left-1/2 top-[34rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-emerald-300/[.035] blur-[110px]" />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/[.06] text-xl text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,.08)] transition duration-300 hover:rotate-3 hover:scale-105">✦</div>
          <div><div className="text-sm font-semibold tracking-wide">PAL</div><div className="text-[9px] uppercase tracking-[.22em] text-zinc-600">Trading Buddy</div></div>
        </div>
        <div className="hidden items-center gap-7 text-[9px] uppercase tracking-[.18em] text-zinc-600 md:flex"><a href="#why" className="transition hover:text-zinc-200">Why PAL</a><a href="#features" className="transition hover:text-zinc-200">Features</a><a href="#method" className="transition hover:text-zinc-200">Method</a></div>
        <button type="button" onClick={onEnter} className="rounded-xl border border-white/[.08] bg-white/[.035] px-4 py-2.5 text-[10px] font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-emerald-300/20 hover:text-white">Enter Workspace →</button>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        <section className="grid gap-12 pb-20 pt-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pt-20">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2"><Pill>Evidence first</Pill><Pill>Macro aware</Pill><Pill>MT5 connected</Pill></div>
            <h1 className="mt-7 max-w-[760px] text-[48px] font-semibold leading-[1.04] tracking-tight text-white sm:text-[54px] lg:text-[60px] xl:text-[64px]">Your trading desk,<br /><span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-white bg-clip-text text-transparent lg:whitespace-nowrap">with an AI beside you.</span></h1>
            <p className="mt-7 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base">PAL Trading Buddy brings live market evidence, macro context, AI reasoning and your MT5 history into one calm workspace built to help you think clearly and execute your own plan.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><button type="button" onClick={onEnter} className="rounded-2xl bg-emerald-300 px-5 py-3 text-xs font-bold text-[#03110c] shadow-[0_15px_40px_rgba(52,211,153,.16)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(52,211,153,.22)]">Enter PAL Workspace</button><span className="rounded-2xl border border-white/[.07] bg-white/[.02] px-5 py-3 text-xs text-zinc-500">Private · evidence-first · uncertainty stays visible</span></div>
            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Today layer" value="LIVE" tone="text-emerald-300" /><MiniStat label="Macro layer" value="SEPARATE" tone="text-cyan-300" /><MiniStat label="Journal" value="MT5" /><MiniStat label="AI" value="PAL" tone="text-amber-300" /></div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-8 rounded-[3rem] bg-emerald-300/[.035] blur-3xl" />
            <div className="relative aspect-square overflow-hidden rounded-[2.8rem] border border-emerald-300/15 bg-[#071311]/95 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
              <div className="absolute inset-7 rounded-[2.25rem] border border-white/[.06] bg-[radial-gradient(circle_at_50%_30%,rgba(61,220,151,.19),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,.10),transparent_42%)]" />
              <div className="absolute left-1/2 top-[22%] h-40 w-40 -translate-x-1/2 rounded-full border border-emerald-200/20 bg-emerald-300/[.05] shadow-[0_0_120px_rgba(52,211,153,.14)] motion-safe:animate-pulse" />
              <div className="absolute left-1/2 top-[29%] flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-200/[.08] text-4xl text-cyan-100 shadow-[0_0_60px_rgba(34,211,238,.18)] transition duration-500 hover:scale-105">✦</div>
              <div className="absolute left-5 top-6 rounded-xl border border-white/[.06] bg-black/25 px-3 py-2 backdrop-blur-xl"><div className="text-[8px] uppercase tracking-[.16em] text-zinc-600">PAL</div><div className="mt-1 text-[10px] font-semibold text-emerald-300">INTELLIGENCE</div></div>
              <div className="absolute right-5 top-6 rounded-xl border border-white/[.06] bg-black/25 px-3 py-2 text-right backdrop-blur-xl"><div className="text-[8px] uppercase tracking-[.16em] text-zinc-600">STATUS</div><div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" />LIVE</div></div>
              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/[.06] bg-black/40 p-4 backdrop-blur-xl"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.2em] text-zinc-600">Current evidence</span><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[8px] font-bold text-emerald-300">READING</span></div><p className="mt-3 text-xs leading-5 text-zinc-300">“I’ll separate today’s evidence from the broader regime before giving you a view.”</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5"><div className="text-[8px] text-zinc-600">DXY</div><div className="mt-1 text-[10px] font-semibold text-amber-300">NEUTRAL</div></div><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5"><div className="text-[8px] text-zinc-600">GBP</div><div className="mt-1 text-[10px] font-semibold text-emerald-300">BULLISH</div></div><div className="rounded-xl border border-white/[.05] bg-white/[.02] p-2.5"><div className="text-[8px] text-zinc-600">GBP/USD</div><div className="mt-1 text-[10px] font-semibold text-emerald-300">BULLISH</div></div></div></div>
            </div>
          </div>
        </section>

        <section id="why" className="scroll-mt-10 border-t border-white/[.06] py-16"><div className="max-w-2xl"><div className="text-[9px] uppercase tracking-[.24em] text-cyan-300">Why PAL exists</div><h2 className="mt-3 text-3xl font-semibold text-white">Less noise. More evidence. Better decisions.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Trading gets harder when charts, news, calendars and journals live in different places. PAL turns those layers into one workspace while keeping missing evidence visible rather than filling gaps with confident guesses.</p></div><div id="features" className="mt-8 grid scroll-mt-10 gap-4 md:grid-cols-2 xl:grid-cols-4"><Feature eyebrow="Today" title="Live bias" body="Keep current trading-day evidence separate from the longer-term regime so the active session remains the first decision layer." icon="⌁" /><Feature eyebrow="Macro" title="Macro desk" body="See DXY, GBP and GBP/USD regime context with explicit evidence rather than generic commentary." icon="◈" /><Feature eyebrow="AI" title="PAL Intelligence" body="Ask natural-language questions about the evidence on your dashboard, macro desk or trading journal." icon="✦" /><Feature eyebrow="Journal" title="MT5 history" body="Connect a local MetaTrader 5 terminal and turn executed trades into a professional performance journal." icon="▣" /></div></section>

        <section id="method" className="grid scroll-mt-10 gap-6 border-t border-white/[.06] py-16 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-7"><div className="text-[9px] uppercase tracking-[.22em] text-emerald-300">How PAL thinks</div><div className="mt-6 space-y-5"><div><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-300/[.05] text-[9px] text-emerald-300">01</span><span className="font-semibold text-white">Read today</span></div><p className="mt-2 pl-10 text-xs leading-5 text-zinc-500">Current-day news, releases and market evidence come first.</p></div><div><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[.05] text-[9px] text-cyan-300">02</span><span className="font-semibold text-white">Read the regime</span></div><p className="mt-2 pl-10 text-xs leading-5 text-zinc-500">Broader macro stays in its own layer so it does not silently override today’s evidence.</p></div><div><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300/15 bg-amber-300/[.05] text-[9px] text-amber-300">03</span><span className="font-semibold text-white">Say what is known</span></div><p className="mt-2 pl-10 text-xs leading-5 text-zinc-500">Unknown stays unknown. Missing evidence is surfaced instead of filled with guesses.</p></div></div></div><div className="rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[.08] via-white/[.02] to-cyan-300/[.04] p-7"><div className="flex items-center justify-between gap-4"><div><div className="text-[9px] uppercase tracking-[.22em] text-cyan-300">Built for traders</div><h3 className="mt-3 text-3xl font-semibold text-white">Your process stays yours.</h3></div><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[.08] bg-black/20 text-2xl text-cyan-200 shadow-[0_0_40px_rgba(34,211,238,.08)]">✦</div></div><p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">PAL is not here to replace your plan. It is here to organize the information around it, challenge weak assumptions, surface contradictions and make your review process faster.</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><MiniStat label="Market" value="LIVE" tone="text-emerald-300" /><MiniStat label="Context" value="MACRO" tone="text-cyan-300" /><MiniStat label="History" value="MT5" /></div><button type="button" onClick={onEnter} className="mt-7 rounded-xl border border-white/[.09] bg-black/20 px-4 py-3 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/20">Open PAL →</button></div></section>

        <section className="border-t border-white/[.06] py-14 text-center"><div className="mx-auto max-w-2xl"><div className="text-[9px] uppercase tracking-[.24em] text-zinc-600">The workspace</div><h2 className="mt-3 text-3xl font-semibold text-white">Built to sit beside your trading plan.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Live evidence. Macro context. AI reasoning. MT5 history. One calm place to review the market and your own execution.</p><button type="button" onClick={onEnter} className="mt-7 rounded-2xl bg-emerald-300 px-6 py-3 text-xs font-bold text-[#03110c] shadow-[0_15px_40px_rgba(52,211,153,.15)] transition hover:-translate-y-0.5">Enter PAL Workspace</button></div></section>

        <footer className="border-t border-white/[.06] pt-8 text-center text-[9px] uppercase tracking-[.18em] text-zinc-700">PAL Trading Buddy · Evidence before conviction · Private trading workspace</footer>
      </main>
    </div>
  );
}
