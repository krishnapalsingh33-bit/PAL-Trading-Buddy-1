import { useEffect, useState } from "react";
import api from "../../api/pal";

type Range = "1D" | "5D" | "1M";
type Point = { time: number; value: number };
type Quote = { price?: number | null; change_percent?: number | null; timestamp?: string | null; source?: string; status?: string };
type Props = { markets: Record<string, Quote> };

const ASSETS = [
  { symbol: "DXY", label: "Dollar Index", kind: "USD strength" },
  { symbol: "XAUUSD", label: "Gold", kind: "Gold futures proxy" },
  { symbol: "BTCUSD", label: "Bitcoin", kind: "BTC · USD" },
  { symbol: "GBPUSD", label: "GBP / USD", kind: "FX spot" },
] as const;

function fmt(value: unknown, symbol: string) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: symbol === "GBPUSD" ? 5 : 2, minimumFractionDigits: symbol === "GBPUSD" ? 4 : 2 });
}
function pct(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
}

export default function MarketCharts({ markets }: Props) {
  const [range, setRange] = useState<Range>("1D");
  const [history, setHistory] = useState<Record<string, Point[]>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(ASSETS.map(async (asset) => {
      try {
        const response = await api.get<{ points?: Point[] }>(`/pal/history/${asset.symbol}`, { params: { range } });
        return [asset.symbol, Array.isArray(response.data?.points) ? response.data.points.filter((point: Point) => Number.isFinite(Number(point?.value))) : [], false] as const;
      } catch {
        return [asset.symbol, [], true] as const;
      }
    })).then((results) => {
      if (!alive) return;
      const nextHistory: Record<string, Point[]> = {};
      const nextFailed: Record<string, boolean> = {};
      results.forEach(([symbol, points, isFailed]) => { nextHistory[symbol] = points; nextFailed[symbol] = isFailed; });
      setHistory(nextHistory);
      setFailed(nextFailed);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-cyan-300/10 bg-[#071117] p-4 shadow-[0_20px_70px_-55px_rgba(34,211,238,.3)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">PRICE STRUCTURE · HISTORICAL FEED</div><h2 className="mt-1 text-lg font-semibold">Four-market chart desk</h2><p className="mt-1 text-[10px] text-zinc-600">Bar-based movement view · no squiggly overlay lines</p></div>
        <div className="flex gap-1 rounded-xl border border-white/[.07] bg-black/20 p-1">{(["1D", "5D", "1M"] as Range[]).map((item) => <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-lg px-3 py-2 text-[9px] font-black transition ${range === item ? "bg-cyan-300/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,.08)]" : "text-zinc-600 hover:text-zinc-300"}`}>{item}</button>)}</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ASSETS.map((asset) => {
          const points = (history[asset.symbol] ?? []).slice(-42);
          const values = points.map(point => Number(point.value)).filter(Number.isFinite);
          const min = values.length ? Math.min(...values) : 0;
          const max = values.length ? Math.max(...values) : 0;
          const span = max - min || 1;
          const positive = values.length > 1 ? values[values.length - 1] >= values[0] : null;
          const quote = markets?.[asset.symbol] ?? {};
          return <article key={asset.symbol} className="group min-w-0 rounded-2xl border border-white/[.07] bg-gradient-to-b from-[#0b1b21] to-[#071015] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:shadow-[0_0_25px_rgba(34,211,238,.07)]">
            <div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black tracking-[.08em] text-zinc-200">{asset.symbol}</div><div className="mt-1 text-[8px] text-zinc-600">{asset.kind}</div></div><span className={`rounded-md border px-2 py-1 text-[8px] font-bold ${positive === null ? "border-white/10 text-zinc-600" : positive ? "border-emerald-300/15 bg-emerald-300/[.04] text-emerald-300" : "border-red-300/15 bg-red-300/[.04] text-red-300"}`}>{positive === null ? "—" : positive ? "UP" : "DOWN"}</span></div>
            <div className="mt-4 text-xl font-semibold tabular-nums text-white">{fmt(quote.price, asset.symbol)}</div><div className={`mt-1 text-[9px] font-mono ${Number(quote.change_percent) > 0 ? "text-emerald-300" : Number(quote.change_percent) < 0 ? "text-red-300" : "text-zinc-600"}`}>{pct(quote.change_percent)} <span className="text-zinc-700">· current snapshot</span></div>
            <div className="mt-4 flex h-[76px] items-end gap-[3px] overflow-hidden border-b border-white/[.06] pb-1" aria-label={`${asset.symbol} historical bar chart`}>
              {points.length > 1 ? points.map((point, index) => {
                const height = 12 + ((Number(point.value) - min) / span) * 78;
                const when = new Date(point.time * 1000).toLocaleString();
                return <div key={`${point.time}-${index}`} title={`${when}: ${fmt(point.value, asset.symbol)}`} className={`min-w-[2px] flex-1 rounded-t-[3px] transition-all duration-300 group-hover:opacity-100 ${positive ? "bg-emerald-300/60 hover:bg-emerald-200" : "bg-red-300/60 hover:bg-red-200"}`} style={{ height: `${height}%`, opacity: .48 + (index / points.length) * .5 }} />;
              }) : <div className="flex h-full w-full items-center justify-center text-[8px] uppercase tracking-[.15em] text-zinc-700">{loading ? "Loading history…" : failed[asset.symbol] ? "History feed unavailable" : "Collecting bars"}</div>}
            </div>
            <div className="mt-2 flex justify-between gap-2 text-[8px] text-zinc-700"><span>{range} · {points.length} bars shown</span><span>{quote.source ?? "Yahoo Finance"}</span></div>
          </article>;
        })}
      </div>
      <div className="mt-3 text-[8px] leading-4 text-zinc-700">Gold uses GC=F futures as a proxy for spot gold. Historical bars and live snapshots can have different update delays; this view does not itself create a trade signal.</div>
    </section>
  );
}
