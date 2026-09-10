import { useEffect, useState } from "react";
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
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash !== "#dashboard") {
        window.history.replaceState(null, "", "#dashboard");
      }
      setPage("dashboard");
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigate = () => {
    if (window.location.hash !== "#dashboard") {
      window.location.hash = "dashboard";
    }
    setPage("dashboard");
  };

  return (
    <>
      <MarketStatusBanner />
      <FinalDashboard onPageChange={navigate} />
      <PALAssistantDock />
    </>
  );
}

function Entry() {
  const desktop = isDesktopApp();
  const mobileLike = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
  const [showLogin, setShowLogin] = useState(
    () => window.sessionStorage.getItem("pal_enter_workspace") === "1",
  );

  // Native/mobile builds should open the PAL workspace directly.
  // Desktop Electron also keeps its existing direct-launch behavior.
  if (desktop || mobileLike) return <Workspace />;

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
