import { useEffect, useMemo, useState } from "react";

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN" | "WARMING UP" | "MARKET CLOSED";

type Props = { report: any };

const SESSION_WINDOWS = [
  { name: "Sydney", start: 21, end: 6 },
  { name: "Asia", start: 0, end: 9 },
  { name: "London", start: 7, end: 16 },
  { name: "New York", start: 13, end: 22 },
] as const;

function normalizeBias(value: unknown): Bias {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("CLOSED")) return "MARKET CLOSED";
  if (raw.includes("BULL")) return "BULLISH";
  if (raw.includes("BEAR")) return "BEARISH";
  if (raw.includes("WARM")) return "WARMING UP";
  if (raw === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}
function biasClass(value: Bias) {
  if (value === "BULLISH") return "text-emerald-300";
  if (value === "BEARISH") return "text-red-300";
  if (value === "WARMING UP") return "text-cyan-300";
  if (value === "MARKET CLOSED") return "text-amber-300";
  if (value === "NEUTRAL") return "text-amber-300";
  return "text-zinc-600";
}
function utcHour(date: Date) { return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600; }
function isOpen(hour: number, start: number, end: number) { return start < end ? hour >= start && hour < end : hour >= start || hour < end; }
function nextBoundary(date: Date, start: number, end: number, open: boolean) { const currentHour = utcHour(date); const targetHour = open ? end : start; let deltaHours = targetHour - currentHour; if (deltaHours <= 0) deltaHours += 24; return date.getTime() + deltaHours * 3600 * 1000; }
function countdown(targetMs: number, nowMs: number) { const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`; }
function collectEvents(report: any) { const candidates = [...(Array.isArray(report?.upcoming_events) ? report.upcoming_events : []), ...(Array.isArray(report?.events) ? report.events : []), ...(Array.isArray(report?.news?.upcoming_events) ? report.news.upcoming_events : [])]; const seen = new Set<string>(); return candidates.filter((event) => { const key = `${event?.title ?? event?.event ?? ""}-${event?.scheduled_time ?? event?.time ?? event?.timestamp ?? ""}`; if (!key || seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => { const rank = (value: unknown) => ({ high: 0, medium: 1, low: 2 }[String(value ?? "").toLowerCase()] ?? 3); return rank(a?.impact) - rank(b?.impact); }).slice(0, 5); }

export default function CommandCenter({ report }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const today = report?.today?.today ?? {};
  const rightNow = today?.right_now ?? {};
  const markets = report?.markets ?? report?.macro?.markets ?? report?.market_data ?? {};
  const events = useMemo(() => collectEvents(report), [report]);
  const dxy = normalizeBias(rightNow?.dxy?.bias);
  const gbpusd = normalizeBias(rightNow?.gbpusd?.bias);
  const dayBias = normalizeBias(today?.gbpusd?.bias);
  const dxyStatus = String(markets?.DXY?.right_now_status ?? "").toUpperCase();
  const pairStatus = String(markets?.GBPUSD?.right_now_status ?? "").toUpperCase();
  const effectiveDxy = dxyStatus === "MARKET_CLOSED" ? "MARKET CLOSED" : dxy;
  const effectivePair = pairStatus === "MARKET_CLOSED" ? "MARKET CLOSED" : gbpusd;
  const dxyMomentum = Number(rightNow?.dxy?.momentum);
  const gbpusdMomentum = Number(rightNow?.gbpusd?.momentum);
  const sync = effectiveDxy === "BEARISH" && effectivePair === "BULLISH" || effectiveDxy === "BULLISH" && effectivePair === "BEARISH";
  const highEvents = events.filter((event) => String(event?.impact ?? "").toLowerCase() === "high").length;
  const mediumEvents = events.filter((event) => String(event?.impact ?? "").toLowerCase() === "medium").length;
  const momentumHeat = [dxyMomentum, gbpusdMomentum].filter(Number.isFinite).reduce((sum, value) => sum + Math.abs(value), 0);
  const volatility = Math.min(100, Math.round(momentumHeat * 650 + highEvents * 25 + mediumEvents * 8));
  const risk = highEvents >= 2 ? "HIGH" : highEvents === 1 || mediumEvents >= 3 ? "MEDIUM" : volatility >= 65 ? "MEDIUM" : effectiveDxy === "MARKET CLOSED" || effectivePair === "MARKET CLOSED" ? "MARKET CLOSED" : effectiveDxy === "WARMING UP" || effectivePair === "WARMING UP" ? "UNKNOWN" : "LOW";
  const dataStatuses = [markets?.DXY?.status, markets?.GBPUSD?.status, markets?.XAUUSD?.status, markets?.USOIL?.status, markets?.US10Y?.status, markets?.US500?.status];
  const liveCount = dataStatuses.filter((status) => String(status ?? "").toUpperCase() === "CURRENT").length;

  return <section className="mx-auto mt-4 max-w-[1500px] px-5 lg:px-8"><div className="overflow-hidden rounded-3xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,.06),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,.025),rgba(255,255,255,.012))] p-5 shadow-[0_30px_100px_-65px_rgba(34,211,238,.45)] lg:p-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /><span className="text-[9px] font-bold uppercase tracking-[.24em] text-cyan-300">PAL COMMAND CENTER</span></div><h2 className="mt-2 text-2xl font-semibold text-white">Market environment at a glance</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">Live sessions, current market state, event risk and provider health—without mixing in any private trading methodology.</p></div><div className="rounded-xl border border-white/[.07] bg-black/20 px-3 py-2 font-mono text-[10px] text-zinc-400">{now.toLocaleTimeString([], { hour12: false })} · {risk}</div></div>
    <div className="mt-5 grid gap-3 xl:grid-cols-4"><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Today</div><div className={`mt-3 text-lg font-bold ${biasClass(dayBias)}`}>{dayBias}</div><div className="mt-1 text-[9px] text-zinc-600">GBP/USD · {Number(today?.confidence ?? 0)}% confidence</div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Right now</div><div className="mt-3 flex items-center gap-4"><div><div className={`text-sm font-bold ${biasClass(effectiveDxy)}`}>DXY {effectiveDxy}</div><div className={`mt-1 text-[9px] ${biasClass(effectiveDxy)}`}>{Number.isFinite(dxyMomentum) ? `${dxyMomentum >= 0 ? "+" : ""}${dxyMomentum.toFixed(3)}%` : "—"}</div></div><div className="h-8 w-px bg-white/[.06]" /><div><div className={`text-sm font-bold ${biasClass(effectivePair)}`}>GBP/USD {effectivePair}</div><div className={`mt-1 text-[9px] ${biasClass(effectivePair)}`}>{Number.isFinite(gbpusdMomentum) ? `${gbpusdMomentum >= 0 ? "+" : ""}${gbpusdMomentum.toFixed(3)}%` : "—"}</div></div></div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Market sync</div><div className={`mt-3 text-lg font-bold ${sync ? "text-emerald-300" : effectiveDxy === "MARKET CLOSED" || effectivePair === "MARKET CLOSED" ? "text-amber-300" : "text-amber-300"}`}>{sync ? "ALIGNED" : effectiveDxy === "MARKET CLOSED" || effectivePair === "MARKET CLOSED" ? "MARKET CLOSED" : "MIXED"}</div><div className="mt-1 text-[9px] text-zinc-600">DXY ↔ GBP/USD relationship</div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Data health</div><div className={`mt-3 text-lg font-bold ${liveCount > 0 ? "text-emerald-300" : "text-amber-300"}`}>{risk === "MARKET CLOSED" ? "MARKET CLOSED" : `${liveCount}/6 LIVE`}</div><div className="mt-1 text-[9px] text-zinc-600">Provider observations current</div></div></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_.85fr_.85fr]"><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-center justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Session board</div><div className="mt-1 text-xs font-semibold text-white">Open / closed + countdown</div></div><span className="text-[8px] uppercase tracking-wider text-zinc-700">UTC session engine</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{SESSION_WINDOWS.map((session)=>{const open=isOpen(utcHour(now),session.start,session.end);const endMs=nextBoundary(now,session.start,session.end,open);return <div key={session.name} className={`rounded-xl border p-3 ${open?"border-emerald-300/15 bg-emerald-300/[.04]":"border-white/[.05] bg-white/[.015]"}`}><div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-zinc-300">{session.name}</span><span className={`text-[7px] font-bold uppercase tracking-wider ${open?"text-emerald-300":"text-zinc-700"}`}>{open?"OPEN":"CLOSED"}</span></div><div className="mt-3 font-mono text-xs text-white">{countdown(endMs,now.getTime())}</div><div className="mt-1 text-[7px] uppercase tracking-wider text-zinc-700">{open?"until close":"until open"}</div></div>;})}</div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Event radar</div><div className={`mt-3 text-lg font-bold ${highEvents?"text-red-300":mediumEvents?"text-amber-300":"text-emerald-300"}`}>{highEvents?`${highEvents} HIGH`:mediumEvents?`${mediumEvents} MEDIUM`:"CLEAR"}</div><div className="mt-1 text-[9px] text-zinc-600">Next catalysts from current feed</div><div className="mt-3 space-y-2">{events.slice(0,3).map((event:any,index:number)=><div key={`${event?.title??event?.event}-${index}`} className="truncate text-[9px] text-zinc-500"><span className="text-zinc-700">{String(event?.impact??"").toUpperCase()}</span> · {event?.title??event?.event??"Economic event"}</div>)}{!events.length&&<div className="text-[9px] text-zinc-700">No event feed available.</div>}</div></div><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.2em] text-zinc-700">Risk pulse</div><div className={`mt-3 text-lg font-bold ${risk==="HIGH"?"text-red-300":risk==="MEDIUM"?"text-amber-300":risk==="LOW"?"text-emerald-300":"text-cyan-300"}`}>{risk}</div><div className="mt-1 text-[9px] text-zinc-600">General market conditions only</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className={`h-full rounded-full transition-all duration-700 ${risk==="HIGH"?"bg-red-300/80":risk==="MEDIUM"?"bg-amber-300/80":risk==="LOW"?"bg-emerald-300/80":"bg-cyan-300/70"}`} style={{width:`${Math.max(8,volatility)}%`}}/></div><div className="mt-2 text-[8px] text-zinc-700">Volatility pulse {volatility}/100</div></div></div>
  </div></section>;
}
