import { useState } from "react";
import FinalDashboard from "./pages/FinalDashboard";
import LandingPage from "./pages/LandingPage";
import AuthGate from "./auth/AuthGate";
import PALAssistantDock from "./components/ai/PALAssistantDock";
import MarketStatusBanner from "./components/MarketStatusBanner";
import type { Page } from "./components/layout/Sidebar";
import "./styles/pal-reference.css";

function isDesktopApp() {
  return /Electron/i.test(navigator.userAgent);
}

function Workspace() {
  const [page, setPage] = useState<Page>("dashboard");
  const navigate = (nextPage: Page) => setPage(nextPage);

  return (
    <>
      <MarketStatusBanner />
      <FinalDashboard activePage={page} onPageChange={navigate} />
      <PALAssistantDock />
    </>
  );
}

function Entry() {
  const desktop = isDesktopApp();
  const [showLogin, setShowLogin] = useState(
    () => window.sessionStorage.getItem("pal_enter_workspace") === "1",
  );

  if (desktop) return <Workspace />;

  if (!showLogin) {
    return (
      <LandingPage
        onEnter={() => {
          window.sessionStorage.setItem("pal_enter_workspace", "1");
          setShowLogin(true);
        }}
      />
    );
  }

  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}

export default function App() {
  return <Entry />;
}
