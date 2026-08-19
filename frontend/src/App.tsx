import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import JournalProfessional from "./pages/JournalProfessional";
import JournalScreenshots from "./components/journal/JournalScreenshots";
import MacroDesk from "./pages/MacroDesk";
import MacroViewPremium from "./pages/MacroViewPremium";
import MacroCalendar from "./pages/MacroCalendar";
import DailyReports from "./pages/DailyReports";
import PalPageShell from "./components/layout/PalPageShell";
import AuthGate from "./auth/AuthGate";
import type { Page } from "./components/layout/Sidebar";
import "./styles/pal-reference.css";

type AppPage = Page;
function getPageFromHash(): AppPage { const hash=window.location.hash.replace(/^#/,""); if(hash==="journal")return "journal"; if(hash==="macro-desk")return "macro-desk"; if(hash==="macro-view")return "macro-view"; if(hash==="macro-calendar")return "macro-calendar"; if(hash==="reports")return "reports"; return "dashboard"; }
function Workspace(){
 const [page,setPage]=useState<AppPage>(getPageFromHash);
 useEffect(()=>{const h=()=>setPage(getPageFromHash());window.addEventListener("hashchange",h);return()=>window.removeEventListener("hashchange",h)},[]);
 const navigate=(next:AppPage)=>{const hash=`#${next}`;if(window.location.hash!==hash)window.location.hash=hash;else setPage(next)};
 if(page==="journal")return <PalPageShell page="journal" onPageChange={navigate}><JournalProfessional/><JournalScreenshots/></PalPageShell>;
 if(page==="macro-desk")return <MacroDesk onPageChange={navigate}/>;
 if(page==="macro-view")return <MacroViewPremium onPageChange={navigate}/>;
 if(page==="macro-calendar")return <MacroCalendar onPageChange={navigate}/>;
 if(page==="reports")return <DailyReports onPageChange={navigate}/>;
 return <div className="pal-dashboard"><Dashboard/></div>;
}
export default function App(){return <AuthGate><Workspace/></AuthGate>}
