import { useMT5Status } from "../../hooks/useMT5Status";

export default function MT5ConnectionCard() {
    const { data, isLoading, isFetching, refetch } = useMT5Status();
    const connected = data?.connected === true;
    const checking = isLoading || (isFetching && !data);

    const label = checking
        ? "CHECKING"
        : connected
          ? "CONNECTED"
          : data?.status === "UNAVAILABLE"
            ? "UNAVAILABLE"
            : "NOT CONNECTED";

    return (
        <section className={`mb-5 overflow-hidden rounded-2xl border ${connected ? "border-emerald-300/15 bg-emerald-300/[.035]" : "border-amber-300/15 bg-amber-300/[.025]"}`}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${connected ? "border-emerald-300/20 bg-emerald-300/[.08]" : "border-amber-300/20 bg-amber-300/[.06]"}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.8)]" : "bg-amber-300"} ${checking ? "animate-pulse" : ""}`} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[.2em] text-zinc-500">MetaTrader 5</span>
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wider ${connected ? "bg-emerald-300/10 text-emerald-300" : "bg-amber-300/10 text-amber-300"}`}>{label}</span>
                        </div>
                        {connected && data?.account ? (
                            <p className="mt-1 truncate text-[10px] text-zinc-500">{data.account.server} · Account {data.account.login} · Equity {data.account.currency} {data.account.equity.toFixed(2)}</p>
                        ) : (
                            <p className="mt-1 text-[10px] text-zinc-500">{data?.reason || "Checking the local MT5 terminal…"}</p>
                        )}
                    </div>
                </div>
                <button type="button" onClick={() => refetch()} disabled={isFetching} className="rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] font-semibold text-zinc-300 transition hover:border-emerald-300/20 hover:text-white disabled:cursor-wait disabled:opacity-50">
                    {isFetching ? "Checking…" : "↻ Retry connection"}
                </button>
            </div>
            {!connected && !checking ? (
                <div className="border-t border-white/[.05] px-4 py-2.5 text-[9px] text-zinc-600">
                    Open MetaTrader 5 and make sure your trading account is logged in, then press Retry. PAL does not store your broker password.
                </div>
            ) : null}
        </section>
    );
}
