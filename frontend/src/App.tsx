import { useEffect, useState } from "react";

import Dashboard from "./pages/Dashboard";
import JournalTest from "./pages/JournalTest";

type Page = "dashboard" | "journal";

function getPageFromHash(): Page {
    return window.location.hash === "#journal"
        ? "journal"
        : "dashboard";
}

function App() {

    const [page, setPage] = useState<Page>(
        getPageFromHash
    );

    useEffect(() => {

        const handleHashChange = () => {
            setPage(getPageFromHash());
        };

        window.addEventListener(
            "hashchange",
            handleHashChange
        );

        return () => {
            window.removeEventListener(
                "hashchange",
                handleHashChange
            );
        };

    }, []);

    const navigate = (nextPage: Page) => {

        const nextHash =
            nextPage === "journal"
                ? "#journal"
                : "#dashboard";

        if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
        } else {
            setPage(nextPage);
        }
    };

    /*
     * ============================================================
     * JOURNAL
     * ============================================================
     */

    if (page === "journal") {

        return (
            <div className="min-h-screen bg-zinc-950">

                <JournalTest />

            </div>
        );
    }

    /*
     * ============================================================
     * DASHBOARD
     * ============================================================
     */

    return (
        <Dashboard
            activePage="dashboard"
            onPageChange={navigate}
        />
    );
}

export default App;