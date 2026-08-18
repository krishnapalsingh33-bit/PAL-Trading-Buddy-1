import Sidebar, { type Page } from "./Sidebar";

type Props = {
    page: Page;
    children: React.ReactNode;
    symbol?: string;
    onPageChange: (page: Page) => void;
};

export default function PalPageShell({
    page,
    children,
    symbol = "GBPUSD",
    onPageChange,
}: Props) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="flex min-h-screen">
                <Sidebar
                    symbol={symbol}
                    activePage={page}
                    onPageChange={onPageChange}
                />
                <main className="min-w-0 flex-1 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
