import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import JournalProfessional from "./pages/JournalProfessional";
import JournalScreenshots from "./components/journal/JournalScreenshots";
import MacroDesk from "./pages/MacroDesk";
import MacroViewPremium from "./pages/MacroViewPremium";
import MacroCalendar from "./pages/MacroCalendar";
import DailyReports from "./pages/DailyReports";
import PalPageShell from "./components/layout/PalPageShell";
import type { Page } from "./components/layout/Sidebar";

type AppPage = Page;
function getPageFromHash(): AppPage { const hash = window.location.hash.replace(/^#/, ""); if (hash === "journal") return "journal"; if (hash === "macro-desk") return "macro-desk"; if (hash === "macro-view") return "macro-view"; if (hash === "macro-calendar") return "macro-calendar"; if (hash === "reports") return "reports"; return "dashboard"; }
function App() {
    const [page,setPage]=useState<AppPage>(getPageFromHash);
    useEffect(()=>{const handleHashChange=()=>setPage(getPageFromHash());window.addEventListener("hashchange",handleHashChange);return()=>window.removeEventListener("hashchange",handleHashChange);},[]);
    const navigate=(nextPage:AppPage)=>{const nextHash=`#${nextPage}`;if(window.location.hash!==nextHash)window.location.hash=nextHash;else setPage(nextPage);};
    if(page==="journal") return <PalPageShell page="journal" onPageChange={navigate}><JournalProfessional/><JournalScreenshots/></PalPageShell>;
    if(page==="macro-desk") return <MacroDesk onPageChange={navigate}/>;
    if(page==="macro-view") return <MacroViewPremium onPageChange={navigate}/>;
    if(page==="macro-calendar") return <MacroCalendar onPageChange={navigate}/>;
    if(page==="reports") return <DailyReports onPageChange={navigate}/>;
    return <Dashboard activePage="dashboard" onPageChange={navigate}/>;
}
export default App;
