import { useEffect, useState } from "react";
import { connectMT5, type MT5Status } from "../../api/mt5";

type Props = {
    open: boolean;
    onClose: () => void;
    onConnected: (status: MT5Status) => void;
    connected?: boolean;
    connectedAccount?: MT5Status["account"];
};

export default function MT5LoginModal({
    open,
    onClose,
    onConnected,
    connected = false,
    connectedAccount = null,
}: Props) {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [server, setServer] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setError("");
        setBusy(false);
        if (connected && connectedAccount) {
            setLogin(String(connectedAccount.login));
            setServer(connectedAccount.server ?? "");
            setPassword("");
        }
    }, [open, connected, connectedAccount]);

    if (!open) return null;

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
            const status = await connectMT5({
                login: Number(login),
                password,
                server: server.trim(),
            });
            onConnected(status);
            setPassword("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "MT5 connection failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/[.09] bg-[#07100f] p-6 shadow-[0_35px_120px_rgba(0,0,0,.65)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[9px] font-bold uppercase tracking-[.22em] text-emerald-300">MetaTrader 5</div>
                        <h2 className="mt-2 text-xl font-semibold text-white">{connected ? "Account connected" : "Connect trading account"}</h2>
                        <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                            {connected
                                ? "PAL is already connected to your MT5 account. Your trading history is being read from the local terminal."
                                : "PAL sends these credentials only to the local connector running on this computer. They are not stored by PAL."}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl border border-white/[.07] bg-white/[.03] px-3 py-2 text-xs text-zinc-500 hover:text-white">×</button>
                </div>

                {connected && connectedAccount ? (
                    <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.045] p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">✓</div>
                            <div>
                                <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-emerald-300">CONNECTED</div>
                                <div className="mt-1 text-sm font-semibold text-white">{connectedAccount.name || "Trading account"}</div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                            <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="text-zinc-600">Account</div><div className="mt-1 text-zinc-200">{connectedAccount.login}</div></div>
                            <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="text-zinc-600">Server</div><div className="mt-1 truncate text-zinc-200">{connectedAccount.server}</div></div>
                            <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="text-zinc-600">Balance</div><div className="mt-1 text-zinc-200">{connectedAccount.currency} {connectedAccount.balance.toFixed(2)}</div></div>
                            <div className="rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="text-zinc-600">Equity</div><div className="mt-1 text-emerald-300">{connectedAccount.currency} {connectedAccount.equity.toFixed(2)}</div></div>
                        </div>
                        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-[10px] font-bold text-[#03110c]">Account is connected — Continue</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <label className="block"><span className="text-[9px] uppercase tracking-widest text-zinc-600">Login</span><input value={login} onChange={(e) => setLogin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/30" placeholder="Trading account number" /></label>
                        <label className="block"><span className="text-[9px] uppercase tracking-widest text-zinc-600">Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" autoComplete="off" className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/30" placeholder="Trading account password" /></label>
                        <label className="block"><span className="text-[9px] uppercase tracking-widest text-zinc-600">Server</span><input value={server} onChange={(e) => setServer(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/30" placeholder="Broker server, e.g. FundingPips-SIM1" /></label>
                        {error ? <div className="rounded-xl border border-red-300/10 bg-red-300/[.04] p-3 text-[10px] leading-5 text-red-200">{error}</div> : null}
                        <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-white/[.08] bg-white/[.03] px-4 py-3 text-[10px] font-semibold text-zinc-500 hover:text-white">Cancel</button><button type="submit" disabled={busy || !login || !password || !server.trim()} className="flex-1 rounded-xl bg-emerald-300 px-4 py-3 text-[10px] font-bold text-[#03110c] disabled:opacity-40">{busy ? "Connecting…" : "Connect MT5"}</button></div>
                    </form>
                )}
            </div>
        </div>
    );
}
