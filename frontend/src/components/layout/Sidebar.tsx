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
    onPageChange?: (page: Page) => void;
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
    const navigate = (page: Page) => {
        onPageChange?.(page);
        window.location.hash = page === "dashboard" ? "dashboard" : page;
    };

    return (
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 p-6">
                <h1 className="text-3xl font-bold text-white">PAL</h1>
                <p className="mt-2 text-sm text-zinc-500">Trading Buddy</p>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto p-4">
                {NAV_ITEMS.map(({ page, label, icon }) => {
                    const active = activePage === page;
                    return (
                        <button
                            key={page}
                            type="button"
                            onClick={() => navigate(page)}
                            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                                active
                                    ? "bg-zinc-800 text-white shadow-[inset_2px_0_0_rgba(52,211,153,.9)]"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                            }`}
                        >
                            <span className="flex h-6 w-6 items-center justify-center text-sm text-emerald-300/80">{icon}</span>
                            <span className="text-sm font-medium">{label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="border-t border-zinc-800 p-5">
                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Active Symbol</p>
                <Badge text={symbol} />
            </div>
        </aside>
    );
}

export default Sidebar;
