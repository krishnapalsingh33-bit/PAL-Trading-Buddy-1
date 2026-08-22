import { useEffect, useMemo, useState } from "react";

function isFxClosed(date: Date) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return true;
  if (day === 0 && hour < 21) return true;
  if (day === 5 && hour >= 21) return true;
  return false;
}

function nextOpen(date: Date) {
  const result = new Date(date);
  result.setUTCSeconds(0, 0);
  const day = result.getUTCDay();
  if (day === 5 && result.getUTCHours() >= 21) result.setUTCDate(result.getUTCDate() + 2);
  else if (day === 6) result.setUTCDate(result.getUTCDate() + 1);
  else if (day === 0 && result.getUTCHours() < 21) {
    // Sunday stays Sunday; open is 21:00 UTC.
  } else return result;
  result.setUTCHours(21, 0, 0, 0);
  return result;
}

export default function MarketStatusBanner() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const closed = isFxClosed(now);
  const opening = useMemo(() => closed ? nextOpen(now) : null, [closed, now]);

  if (!closed) {
    return (
      <div className="border-b border-emerald-300/10 bg-emerald-300/[.03] px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[.18em] text-emerald-300/80">
        <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
        FX market open · live data updating automatically
      </div>
    );
  }

  return (
    <div className="border-b border-amber-300/10 bg-amber-300/[.035] px-4 py-2.5 text-center text-[9px] font-semibold uppercase tracking-[.16em] text-amber-300/90">
      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
      FX MARKET CLOSED · live prices and intraday momentum will resume automatically at {opening?.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}
