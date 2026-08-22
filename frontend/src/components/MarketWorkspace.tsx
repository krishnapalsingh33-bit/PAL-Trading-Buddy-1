import { useMemo, useState } from "react";

type Quote = {
  price?: number | null;
  change_percent?: number | null;
  status?: string;
  source?: string;
  timestamp?: string | null;
  right_now_momentum_percent?: number | null;
  right_now_status?: string;
  right_now_points?: Array<{ time?: string | null; price?: number | null }>;
};

type Props = { markets: Record<string, Quote>; report?: any; onHide?: () => void };

const ASSETS = [
  { key: "DXY", label: "DXY", unit: "Index" },
  { key: "GBPUSD", label: "GBP/USD", unit: "FX" },
  { key: "XAUUSD", label: "Gold", unit: "Metal" },
  { key: "US500", label: "US500", unit: "Index" },
  { key: "USOIL", label: "WTI", unit: "Energy" },
  { key: "US10Y", label: "US 10Y", unit: "Yield" },
] as const;

function fmtPrice(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "—";
}
function fmtPct(value: unknown, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "—";
}
function movement(change: unknown) {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return "→";
  return n > 0 ? "↑" : "↓";
}
function movementClass(change: unknown) {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return "text-zinc-500";
  return n > 0 ? "text-emerald-300" : "text-red-300";
}
function sparkPath(points: Array<{ price?: number | null }>) {
  const values = points.map((point) => Number(point.price)).filter(Number.isFinite) as number[];
  if (values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  return values.map((value, i) => `${(i / (values.length - 1)) * 100},${38 - ((value - min) / span) * 30}`).join(" ");
}

export default function MarketWorkspace({ markets, report, onHide }: Props) {
  const [selected, setSelected] = useState("GBPUSD");
  const selectedAsset = ASSETS.find((asset) => asset.key === selected) ?? ASSETS[0];
  const quote = markets?.[selectedAsset.key] ?? {};
  const path = sparkPath(quote.right_now_points ?? []);
  const liveStatus = String(quote.right_now_status ?? quote.status ?? "UNAVAILABLE").toUpperCase();
  const isClosed = liveStatus === "MARKET_CLOSED";

  const news = useMemo(() => {
    const headlines = Array.isArray(report?.news?.headlines) ? report.news.headlines : Array.isArray(report?.headlines) ? report.headlines : [];
    const label = selectedAsset.label.toLowerCase();
    return headlines.filter((item: any) => {
      const text = `${item?.title ?? ""} ${item?.currency ?? ""}`.toLowerCase();
      return text.includes(label) || (selected === "GBPUSD" && (text.includes("gbp") || text.includes("sterling") || text.includes("dollar"))) || (selected === "XAUUSD" && (text.includes("gold") || text.includes("xau"))) || (selected === "US500" && (text.includes("s&p") || text.includes("stocks"))) || (selected === "USOIL" && (text.includes("oil") || text.includes("crude"))) || (selected === "US10Y" && (text.includes("treasury") || text.includes("yield")));
    }).slice(0, 4);
  }, [report, selected, selectedAsset.label]);

  const movementMessage = isClosed
    ? "Market closed · last available movement retained"
    : liveStatus === "CURRENT"
      ? "Live intraday movement"
      : "Waiting for live movement feed";

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-white/[.07] bg-white/[.018] shadow-[0_25px_90px_-65px_rgba(34,211,238,.35)]">
      <div className="flex flex-col gap-4 border-b border-white/[.06] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${isClosed ? "bg-amber-300" : "animate-pulse bg-emerald-300"}`} /><div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300">Live Market Workspace</div></div>
          <h2 className="mt-2 text-xl font-semibold text-white">One-click market monitor</h2>
          <p className="mt-1 text-xs text-zinc-600">Optional detail workspace · select an asset to expand market context.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-xl border px-3 py-2 text-[8px] font-bold uppercase tracking-wider ${isClosed ? "border-amber-300/20 bg-amber-300/[.05] text-amber-300" : "border-emerald-300/15 bg-emerald-300/[.04] text-emerald-300"}`}>{isClosed ? "FX MARKET CLOSED" : liveStatus === "CURRENT" ? "LIVE" : "FEED WARMING"}</span>
          <button type="button" onClick={onHide} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2 text-[8px] font-bold uppercase tracking-wider text-zinc-400 transition hover:border-cyan-300/20 hover:text-cyan-300">Hide Workspace</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr]">
        <div className="border-b border-white/[.06] lg:border-b-0 lg:border-r">
          <div className="p-3">
            {ASSETS.map((asset) => {
              const item = markets?.[asset.key] ?? {};
              const active = asset.key === selected;
              const itemStatus = String(item.right_now_status ?? item.status ?? "—").toUpperCase();
              return <button key={asset.key} type="button" onClick={() => setSelected(asset.key)} className={`mb-2 w-full rounded-2xl border p-3 text-left transition-all duration-300 ${active ? "border-cyan-300/25 bg-cyan-300/[.05] shadow-[0_0_28px_-18px_rgba(34,211,238,.9)]" : "border-white/[.06] bg-black/15 hover:-translate-y-0.5 hover:border-white/[.12]"}`}><div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold text-white">{asset.label}</div><div className="mt-1 text-[8px] uppercase tracking-wider text-zinc-700">{asset.unit}</div></div><span className={`text-[8px] uppercase tracking-wider ${itemStatus === "MARKET_CLOSED" ? "text-amber-300" : itemStatus === "CURRENT" ? "text-emerald-300" : "text-zinc-600"}`}>{itemStatus}</span></div><div className="mt-3 flex items-end justify-between"><div><div className="text-lg font-semibold text-white">{fmtPrice(item.price)}</div><div className={`mt-1 text-[9px] font-mono ${movementClass(item.change_percent)}`}>{movement(item.change_percent)} {fmtPct(item.change_percent)}</div></div><div className={`text-2xl ${movementClass(item.change_percent)}`}>{movement(item.change_percent)}</div></div></button>;
            })}
          </div>
        </div>

        <div className="min-w-0 p-5 lg:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${isClosed ? "bg-amber-300" : liveStatus === "CURRENT" ? "animate-pulse bg-emerald-300" : "bg-zinc-600"}`} /><span className={`text-[9px] uppercase tracking-[.2em] ${isClosed ? "text-amber-300" : "text-zinc-600"}`}>{isClosed ? "MARKET CLOSED" : liveStatus === "CURRENT" ? "LIVE" : "FEED WARMING"}</span></div><h3 className="mt-2 text-2xl font-semibold text-white">{selectedAsset.label}</h3><p className="mt-1 text-[10px] text-zinc-600">{selectedAsset.unit} · {quote.source ?? "No provider"}</p></div><div className="text-left md:text-right"><div className="text-3xl font-semibold text-white">{fmtPrice(quote.price)}</div><div className={`mt-1 text-[10px] font-mono ${movementClass(quote.change_percent)}`}>{movement(quote.change_percent)} {fmtPct(quote.change_percent)}</div></div></div>

          <div className="mt-5 rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-center justify-between"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">Recent movement</div><span className={`text-[8px] uppercase tracking-wider ${isClosed ? "text-amber-300" : liveStatus === "CURRENT" ? "text-emerald-300" : "text-zinc-700"}`}>{movementMessage}</span></div><div className="mt-4 h-44">{path ? <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="none"><polyline points={path} fill="none" stroke={Number(quote.change_percent) >= 0 ? "#34d399" : "#f87171"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[.18em] text-zinc-700">No movement points supplied by provider</div>}</div></div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">Market snapshot</div><div className="mt-3 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-xl border border-white/[.05] p-3"><div className="text-zinc-700">Today change</div><div className={`mt-1 font-mono text-sm ${movementClass(quote.change_percent)}`}>{fmtPct(quote.change_percent)}</div></div><div className="rounded-xl border border-white/[.05] p-3"><div className="text-zinc-700">Right now</div><div className="mt-1 font-mono text-sm text-zinc-300">{fmtPct(quote.right_now_momentum_percent, 3)}</div></div><div className="rounded-xl border border-white/[.05] p-3"><div className="text-zinc-700">Market status</div><div className={`mt-1 text-sm ${isClosed ? "text-amber-300" : "text-zinc-300"}`}>{isClosed ? "Closed" : "Open"}</div></div><div className="rounded-xl border border-white/[.05] p-3"><div className="text-zinc-700">Last update</div><div className="mt-1 text-[10px] text-zinc-500">{quote.timestamp ? new Date(quote.timestamp).toLocaleTimeString([], { hour12: false }) : "—"}</div></div></div></div>
            <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-700">Relevant headlines</div><div className="mt-3 space-y-2">{news.length ? news.map((item: any, index: number) => <div key={`${item?.title ?? "item"}-${index}`} className="rounded-xl border border-white/[.05] bg-white/[.018] p-3"><div className="text-[10px] leading-4 text-zinc-300">{item?.title ?? "Headline"}</div><div className="mt-1 text-[8px] uppercase tracking-wider text-zinc-700">{item?.source ?? item?.provider ?? "News"}</div></div>) : <div className="rounded-xl border border-white/[.05] bg-white/[.018] p-3 text-[9px] text-zinc-700">No asset-specific headlines are currently available from the PAL news feed.</div>}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
