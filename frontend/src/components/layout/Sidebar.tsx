import { useEffect, useState } from "react";
import Badge from "../ui/Badge";

export type Page =
    | "dashboard"
    | "journal"
    | "macro-desk"
    | "macro-view"
    | "macro-calendar"
    | "reports";

type Props = {
    symbol: string;
    activePage?: Page;
    onPageChange?(page: Page): void;
};

const NAV_ITEMS: Array<{ page: Page; label: string; icon: string }> = [
    { page: "dashboard", label: "Dashboard", icon: "⌂" },
    { page: "journal", label: "Journal", icon: "▣" },
    { page: "macro-desk", label: "Macro Desk", icon: "✦" },
    { page: "macro-view", label: "Macro View", icon: "◈" },
    { page: "macro-calendar", label: "Macro Calendar", icon: "□" },
    { page: "reports", label: "Daily Reports", icon: "▤" },
];

function Sidebar({ symbol, activePage = "dashboard", onPageChange }: Props) {
    const [brightness, setBrightness] = useState<"low" | "medium" | "high">("medium");

    useEffect(() => {
        const saved = window.localStorage.getItem("pal-sidebar-brightness") as "low" | "medium" | "high" | null;
        if (saved) setBrightness(saved);
    }, []);

    const setLevel = (level: "low" | "medium" | "high") => {
        setBrightness(level);
        window.localStorage.setItem("pal-sidebar-brightness", level);
    };

    const navigate = (page: Page) => {
        onPageChange?.(page);
        window.location.hash = page === "dashboard" ? "dashboard" : page;
    };

    return (
        <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col border-r border-cyan-300/[.07] bg-[#020811]">
            <div className="border-b border-white/[.06] px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[.05] text-2xl text-cyan-300 shadow-[0_0_28px_rgba(32,217,255,.12)]">⌁</div>
                    <div>
                        <h1 className="text-[25px] font-semibold leading-none text-white">PAL</h1>
                        <p className="mt-1 text-[12px] text-zinc-500">Trading Buddy</p>
                    </div>
                </div>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
                {NAV_ITEMS.map(({ page, label, icon }) => {
                    const active = activePage === page;
                    return (
                        <button key={page} type="button" onClick={() => navigate(page)} className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition duration-200 ${active ? "border-cyan-300/35 bg-emerald-300/[.10] text-white shadow-[0_0_24px_rgba(32,217,255,.08),inset_0_0_20px_rgba(22,230,160,.05)]" : "border-transparent text-zinc-400 hover:border-white/[.06] hover:bg-white/[.025] hover:text-white"}`}>
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${active ? "bg-cyan-300/[.10] text-cyan-300" : "text-emerald-300/75"}`}>{icon}</span>
                            <span className="text-[14px] font-medium">{label}</span>
                            {active && <span className="ml-auto text-cyan-300">›</span>}
                        </button>
                    );
                })}
            </nav>
            <div className="border-t border-white/[.06] px-5 py-4">
                <div className="mb-4 flex items-center justify-between">
                    <button type="button" title="Settings" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[.07] bg-white/[.025] text-sm text-zinc-400 transition hover:border-cyan-300/25 hover:text-cyan-300">⚙</button>
                    <button type="button" title="Preferences" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[.07] bg-white/[.025] text-sm text-zinc-400 transition hover:border-cyan-300/25 hover:text-cyan-300">⌘</button>
                    <button type="button" title="Account" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[.07] bg-white/[.025] text-sm text-zinc-400 transition hover:border-cyan-300/25 hover:text-cyan-300">◉</button>
                </div>
                <div className="mb-4 h-px bg-white/[.05]" />
                <p className="mb-2 text-[9px] uppercase tracking-[.2em] text-zinc-600">Active Symbol</p>
                <Badge text={symbol} />
                <div className="mt-5">
                    <p className="mb-2 text-[9px] uppercase tracking-[.2em] text-zinc-600">Theme</p>
                    <div className="flex items-center gap-1.5 rounded-xl border border-white/[.06] bg-white/[.018] p-1">
                        <button type="button" title="Low brightness" aria-label="Low brightness" onClick={() => setLevel("low")} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-sm transition ${brightness === "low" ? "bg-cyan-300/[.12] text-cyan-300 shadow-[0_0_14px_rgba(32,217,255,.12)]" : "text-zinc-600 hover:text-zinc-300"}`}>◐</button>
                        <button type="button" title="Medium brightness" aria-label="Medium brightness" onClick={() => setLevel("medium")} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-sm transition ${brightness === "medium" ? "bg-cyan-300/[.12] text-cyan-300 shadow-[0_0_14px_rgba(32,217,255,.12)]" : "text-zinc-600 hover:text-zinc-300"}`}>☼</button>
                        <button type="button" title="High brightness" aria-label="High brightness" onClick={() => setLevel("high")} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-sm transition ${brightness === "high" ? "bg-cyan-300/[.12] text-cyan-300 shadow-[0_0_14px_rgba(32,217,255,.12)]" : "text-zinc-600 hover:text-zinc-300"}`}>☾</button>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
