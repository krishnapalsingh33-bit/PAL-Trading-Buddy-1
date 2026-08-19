import type { ReactNode } from "react";
import Sidebar, { type Page } from "./Sidebar";
import MT5ConnectionCard from "../journal/MT5ConnectionCard";

type Props = {
    page: Page;
    children: ReactNode;
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
                    {page === "journal" ? (
                        <div className="mx-auto w-full max-w-[1500px] px-5 pt-5 sm:px-7 lg:px-9">
                            <MT5ConnectionCard />
                        </div>
                    ) : null}
                    {children}
                </main>
            </div>
        </div>
    );
}
