import Badge from "../ui/Badge";

type Props = {
    symbol: string;
    activePage?: "dashboard" | "journal";
    onPageChange?: (page: "dashboard" | "journal") => void;
};

function Sidebar({
    symbol,
    activePage = "dashboard",
    onPageChange,
}: Props) {

    const navigate = (page: "dashboard" | "journal") => {
        // Notify parent if supplied
        onPageChange?.(page);

        // Also update the URL directly.
        // App.tsx listens for hashchange and switches pages.
        window.location.hash =
            page === "journal"
                ? "journal"
                : "dashboard";
    };

    return (
        <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">

            {/* Logo */}
            <div className="border-b border-zinc-800 p-6">
                <h1 className="text-3xl font-bold text-white">
                    PAL
                </h1>

                <p className="mt-2 text-sm text-zinc-500">
                    Trading Buddy
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 p-4">

                {/* Dashboard */}
                <button
                    type="button"
                    onClick={() => navigate("dashboard")}
                    className={`w-full rounded-xl p-3 text-left transition ${
                        activePage === "dashboard"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                >
                    Dashboard
                </button>

                {/* Journal */}
                <button
                    type="button"
                    onClick={() => navigate("journal")}
                    className={`w-full rounded-xl p-3 text-left transition ${
                        activePage === "journal"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                >
                    Journal
                </button>

            </nav>

            {/* Active Symbol */}
            <div className="border-t border-zinc-800 p-5">

                <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
                    Active Symbol
                </p>

                <Badge text={symbol} />

            </div>

        </aside>
    );
}

export default Sidebar;