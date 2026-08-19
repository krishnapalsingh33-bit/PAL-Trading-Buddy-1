import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Dashboard from "./pages/Dashboard";
import JournalProfessional from "./pages/JournalProfessional";
import JournalScreenshots from "./components/journal/JournalScreenshots";
import MacroDesk from "./pages/MacroDesk";
import MacroViewPremium from "./pages/MacroViewPremium";
import MacroCalendar from "./pages/MacroCalendar";
import DailyReports from "./pages/DailyReports";
import PalPageShell from "./components/layout/PalPageShell";
import AuthGate from "./auth/AuthGate";
import PALAssistantDock from "./components/ai/PALAssistantDock";
import type { Page } from "./components/layout/Sidebar";
import "./styles/pal-reference.css";

type AppPage = Page;
function getPageFromHash(): AppPage { const hash=window.location.hash.replace(/^#/,""); if(hash==="journal")return "journal"; if(hash==="macro-desk")return "macro-desk"; if(hash==="macro-view")return "macro-view"; if(hash==="macro-calendar")return "macro-calendar"; if(hash==="reports")return "reports"; return "dashboard"; }
function Workspace(){
 const [page,setPage]=useState<AppPage>(getPageFromHash);
 useEffect(()=>{const h=()=>setPage(getPageFromHash());window.addEventListener("hashchange",h);return()=>window.removeEventListener("hashchange",h)},[]);
 const navigate=(next:AppPage)=>{const hash=`#${next}`;if(window.location.hash!==hash)window.location.hash=hash;else setPage(next)};
 let content: ReactNode;
 if(page==="journal")content=<PalPageShell page="journal" onPageChange={navigate}><JournalProfessional/><JournalScreenshots/></PalPageShell>;
 else if(page==="macro-desk")content=<MacroDesk onPageChange={navigate}/>;
 else if(page==="macro-view")content=<MacroViewPremium onPageChange={navigate}/>;
 else if(page==="macro-calendar")content=<MacroCalendar onPageChange={navigate}/>;
 else if(page==="reports")content=<DailyReports onPageChange={navigate}/>;
 else content=<div className="pal-dashboard"><Dashboard/></div>;
 return <>{content}<PALAssistantDock/></>;
}
export default function App(){return <AuthGate><Workspace/></AuthGate>}
