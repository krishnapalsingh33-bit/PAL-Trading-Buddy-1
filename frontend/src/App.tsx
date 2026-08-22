import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Dashboard from "./pages/Dashboard";
import JournalProfessional from "./pages/JournalProfessional";
import JournalScreenshots from "./components/journal/JournalScreenshots";
import MacroDesk from "./pages/MacroDesk";
import MacroViewPremium from "./pages/MacroViewPremium";
import MacroCalendar from "./pages/MacroCalendar";
import DailyReports from "./pages/DailyReports";
import LandingPage from "./pages/LandingPage";
import PalPageShell from "./components/layout/PalPageShell";
import AuthGate from "./auth/AuthGate";
import PALAssistantDock from "./components/ai/PALAssistantDock";
import MarketWorkspace from "./components/MarketWorkspace";
import CommandCenter from "./components/CommandCenter";
import { usePAL } from "./hooks/usePAL";
import type { Page } from "./components/layout/Sidebar";
import "./styles/pal-reference.css";

type AppPage = Page;
const WORKSPACE_PREF_KEY = "pal-market-workspace-visible";

function getPageFromHash(): AppPage {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "journal") return "journal";
  if (hash === "macro-desk") return "macro-desk";
  if (hash === "macro-view") return "macro-view";
  if (hash === "macro-calendar") return "macro-calendar";
  if (hash === "reports") return "reports";
  return "dashboard";
}

function DashboardWorkspace() {
  const { data } = usePAL();
  const report: any = data?.report;
  const markets = report?.markets ?? report?.macro?.markets ?? report?.market_data ?? {};
  const [workspaceVisible, setWorkspaceVisible] = useState(() => {
    const stored = window.localStorage.getItem(WORKSPACE_PREF_KEY);
    return stored !== "0";
  });

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_PREF_KEY, workspaceVisible ? "1" : "0");
  }, [workspaceVisible]);

  if (!report) return <Dashboard />;

  return (
    <div className="pal-dashboard">
      <CommandCenter report={report} marketWorkspaceVisible={workspaceVisible} onToggleMarketWorkspace={() => setWorkspaceVisible((value) => !value)} />
      <Dashboard />
      <div className="mx-auto mt-4 max-w-[1500px] px-5 pb-10 lg:px-8">
        <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.018] px-4 py-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">Live Market Workspace</div>
            <div className="mt-1 text-[10px] text-zinc-600">Optional detailed market monitor.</div>
          </div>
          <button type="button" onClick={() => setWorkspaceVisible((value) => !value)} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 transition hover:border-cyan-300/20 hover:text-cyan-300">
            {workspaceVisible ? "Hide Workspace" : "Show Workspace"}
          </button>
        </div>
        {workspaceVisible ? <MarketWorkspace markets={markets} report={report} /> : null}
      </div>
    </div>
  );
}

function Workspace() {
  const [page, setPage] = useState<AppPage>(getPageFromHash);

  useEffect(() => {
    const handleHash = () => setPage(getPageFromHash());
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigate = (next: AppPage) => {
    const hash = `#${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    else setPage(next);
  };

  let content: ReactNode;
  if (page === "journal") {
    content = <PalPageShell page="journal" onPageChange={navigate}><JournalProfessional /><JournalScreenshots /></PalPageShell>;
  } else if (page === "macro-desk") content = <MacroDesk onPageChange={navigate} />;
  else if (page === "macro-view") content = <MacroViewPremium onPageChange={navigate} />;
  else if (page === "macro-calendar") content = <MacroCalendar onPageChange={navigate} />;
  else if (page === "reports") content = <DailyReports onPageChange={navigate} />;
  else content = <DashboardWorkspace />;

  return <>{content}<PALAssistantDock /></>;
}

function Entry() {
  const [showLogin, setShowLogin] = useState(() => window.sessionStorage.getItem("pal_enter_workspace") === "1");
  if (!showLogin) return <LandingPage onEnter={() => { window.sessionStorage.setItem("pal_enter_workspace", "1"); setShowLogin(true); }} />;
  return <AuthGate><Workspace /></AuthGate>;
}

export default function App() { return <Entry />; }
