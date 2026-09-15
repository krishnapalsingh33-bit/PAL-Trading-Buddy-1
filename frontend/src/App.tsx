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

function isNativeMobile() {
  return typeof window !== "undefined" &&
    (window.location.protocol === "capacitor:" ||
      Boolean((window as Window & { Capacitor?: unknown }).Capacitor) ||
      /Capacitor|Android/i.test(navigator.userAgent));
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
  const nativeMobile = isNativeMobile();
  const mobileLike = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
  const [showLogin, setShowLogin] = useState(
    () => window.sessionStorage.getItem("pal_enter_workspace") === "1",
  );

  // Desktop remains unchanged. Native Android and small-screen builds open PAL directly.
  if (desktop || nativeMobile || mobileLike) return <Workspace />;

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
