import { useEffect, useMemo, useState } from "react";
import api from "../../api/pal";

type Range = "1D" | "5D" | "1M";
type Point = { time: number; value: number };
type Quote = {
  price?: number | null;
  change?: number | null;
  change_percent?: number | null;
  previous_price?: number | null;
  timestamp?: string | null;
  source?: string;
  status?: string;
  freshness_seconds?: number | null;
  reason?: string | null;
};
type Props = { markets: Record<string, Quote> };

const ASSETS = [
  { symbol: "DXY", label: "US Dollar Index", providerSymbol: "DX-Y.NYB", color: "teal", icon: "$", kind: "USD strength" },
  { symbol: "XAUUSD", label: "Gold / USD", providerSymbol: "GC=F", color: "gold", icon: "Au", kind: "Gold futures proxy" },
  { symbol: "BTCUSD", label: "Bitcoin / USD", providerSymbol: "BTC-USD", color: "orange", icon: "₿", kind: "Crypto · USD" },
  { symbol: "GBPUSD", label: "British Pound / US Dollar", providerSymbol: "GBPUSD=X", color: "blue", icon: "£", kind: "FX spot" },
] as const;

function fmt(value: unknown, symbol: string) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: symbol === "GBPUSD" ? 5 : 2,
    minimumFractionDigits: symbol === "GBPUSD" ? 4 : 2,
  });
}

function pct(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
}

function freshness(quote: Quote) {
  const status = String(quote.status ?? "UNAVAILABLE").toUpperCase();
  if (status === "CURRENT") return { label: "LIVE", cls: "text-emerald-200 border-emerald-300/25 bg-emerald-300/[.07]", dot: "bg-emerald-300" };
  if (status === "RECENT") return { label: "RECENT", cls: "text-amber-200 border-amber-300/20 bg-amber-300/[.05]", dot: "bg-amber-300" };
  if (status === "STALE") return { label: "STALE", cls: "text-orange-200 border-orange-300/20 bg-orange-300/[.04]", dot: "bg-orange-300" };
  return { label: "NO FEED", cls: "text-zinc-400 border-white/10 bg-white/[.025]", dot: "bg-zinc-600" };
}

function marketTime(value?: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false,
  }) + " IST";
}

export default function MarketCharts({ markets }: Props) {
  const [range, setRange] = useState<Range>("1D");
  const [history, setHistory] = useState<Record<string, Point[]>>({});
  const [historySource, setHistorySource] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(ASSETS.map(async (asset): Promise<[string, Point[], boolean, string]> => {
      try {
        const response = await api.get<{ points?: Point[]; provider_symbol?: string }>(`/pal/history/${asset.symbol}`, { params: { range } });
        const points = Array.isArray(response.data?.points)
          ? response.data.points.filter((point: Point) => Number.isFinite(Number(point?.value)))
          : [];
        return [asset.symbol, points, false, response.data?.provider_symbol || asset.providerSymbol];
      } catch {
        return [asset.symbol, [], true, asset.providerSymbol];
      }
    })).then((results) => {
      if (!alive) return;
      const nextHistory: Record<string, Point[]> = {};
      const nextFailed: Record<string, boolean> = {};
      const nextSource: Record<string, string> = {};
      results.forEach(([symbol, points, isFailed, source]) => {
        nextHistory[symbol] = points;
        nextFailed[symbol] = isFailed;
        nextSource[symbol] = source;
      });
      setHistory(nextHistory);
      setFailed(nextFailed);
      setHistorySource(nextSource);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [range]);

  const connected = useMemo(() => ASSETS.filter((asset) => {
    const quote = markets?.[asset.symbol] ?? {};
    return quote.price != null && ["CURRENT", "RECENT"].includes(String(quote.status ?? "").toUpperCase());
  }).length, [markets]);

  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-emerald-300/15 bg-[#06110e] p-4 shadow-[0_0_36px_rgba(0,255,180,.035)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[.23em] text-emerald-300">LIVE MARKET MONITOR</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Market watch</h2>
          <p className="mt-1 text-[10px] text-zinc-500">{connected}/4 assets have a current or recent quote · provider timestamp shown on each tile</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[.07] bg-black/30 p-1">
          {(["1D", "5D", "1M"] as Range[]).map((item) => (
            <button key={item} type="button" onClick={() => setRange(item)}
              className={`rounded-lg px-3 py-2 text-[9px] font-black transition ${range === item ? "bg-emerald-300/15 text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,.08)]" : "text-zinc-600 hover:text-zinc-300"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ASSETS.map((asset) => {
          const points = (history[asset.symbol] ?? []).slice(-42);
          const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
          const min = values.length ? Math.min(...values) : null;
          const max = values.length ? Math.max(...values) : null;
          const current = Number(markets?.[asset.symbol]?.price);
          const quote = markets?.[asset.symbol] ?? {};
          const move = Number(quote.change_percent);
          const goodMove = Number.isFinite(move) && move > 0;
          const badMove = Number.isFinite(move) && move < 0;
          const status = freshness(quote);
          const rangePct = min !== null && max !== null && max > min && Number.isFinite(current)
            ? Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100))
            : null;
          const palettes = {
            teal: { border: "border-emerald-300/25", ring: "shadow-[0_0_28px_rgba(16,240,180,.045)]", icon: "border-emerald-300/35 bg-emerald-300/[.08] text-emerald-200", range: "from-emerald-700 to-teal-300", glow: "bg-emerald-300" },
            gold: { border: "border-amber-300/25", ring: "shadow-[0_0_28px_rgba(245,190,70,.035)]", icon: "border-amber-300/35 bg-amber-300/[.08] text-amber-200", range: "from-yellow-900 to-amber-300", glow: "bg-amber-300" },
            orange: { border: "border-orange-300/25", ring: "shadow-[0_0_28px_rgba(251,146,60,.035)]", icon: "border-orange-300/35 bg-orange-300/[.08] text-orange-200", range: "from-orange-900 to-orange-300", glow: "bg-orange-300" },
            blue: { border: "border-sky-300/25", ring: "shadow-[0_0_28px_rgba(56,189,248,.035)]", icon: "border-sky-300/35 bg-sky-300/[.08] text-sky-200", range: "from-sky-800 to-sky-300", glow: "bg-sky-300" },
          } as const;
          const palette = palettes[asset.color];
          return (
            <article key={asset.symbol} className={`group relative min-w-0 overflow-hidden rounded-2xl border ${palette.border} bg-gradient-to-br from-[#0a1a15] via-[#07120f] to-[#050b0a] p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(16,240,180,.07)] ${palette.ring}`}>
              <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[.06] blur-2xl ${palette.glow}`} />
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-black ${palette.icon}`}>{asset.icon}</div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black tracking-[.08em] text-slate-100">{asset.symbol}</div>
                    <div className="mt-1 truncate text-[9px] text-zinc-500">{asset.label}</div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-bold tracking-wide ${status.cls}`}>{status.label}</span>
              </div>
              <div className="relative mt-5 min-h-[64px]">
                <div className="text-2xl font-semibold tracking-tight text-white tabular-nums">{fmt(quote.price, asset.symbol)}</div>
                <div className={`mt-1 text-[10px] font-mono ${goodMove ? "text-emerald-300" : badMove ? "text-rose-300" : "text-zinc-500"}`}>
                  {Number.isFinite(move) ? `${move > 0 ? "↗ " : move < 0 ? "↘ " : "→ "}${pct(move)}` : "Change unavailable"}
                  <span className="ml-1 text-[9px] text-zinc-600">vs previous close</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="relative h-[6px] flex-1 rounded-full bg-white/[.08]">
                    {rangePct !== null && <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${palette.range}`} style={{ width: `${Math.max(8, rangePct)}%` }} />}
                    {rangePct !== null && <div className={`absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#07120f] ${palette.glow}`} style={{ left: `${rangePct}%`, boxShadow: "0 0 10px currentColor" }} />}
                  </div>
                  <span className="shrink-0 text-[8px] text-zinc-500">{min !== null && max !== null ? range : "Range —"}</span>
                </div>
                <div className="mt-2 flex justify-between gap-2 text-[8px] font-mono text-zinc-500">
                  <span>{min !== null ? fmt(min, asset.symbol) : "—"}</span>
                  <span className="text-zinc-600">{range === "1D" ? "Observed range" : `${range} range`}</span>
                  <span>{max !== null ? fmt(max, asset.symbol) : "—"}</span>
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between gap-2 border-t border-white/[.07] pt-3">
                <div className="min-w-0">
                  <div className="truncate text-[8px] text-zinc-400">{quote.source || "Provider not reported"}</div>
                  <div className="mt-1 text-[8px] text-zinc-600">{marketTime(quote.timestamp)}</div>
                  {quote.reason && <div className="mt-1 line-clamp-2 text-[8px] text-amber-200/70">{quote.reason}</div>}
                </div>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
              </div>
              <div className="mt-3 text-[8px] uppercase tracking-[.12em] text-zinc-700">
                {asset.symbol === "XAUUSD" ? "Futures proxy · GC=F" : `Yahoo symbol · ${historySource[asset.symbol] || asset.providerSymbol}`}
                {failed[asset.symbol] ? " · history offline" : loading ? " · updating range" : ""}
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[8px] leading-4 text-zinc-600">
        <span>Quotes update with PAL refresh; provider market timestamps determine freshness.</span>
        <span>Gold is labelled as a futures proxy, not spot XAU/USD.</span>
      </div>
    </section>
  );
}
