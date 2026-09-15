import { Capacitor } from "@capacitor/core";

const DEPLOYED_API = "https://pal-trading-buddy-1.onrender.com";

export function isNativeMobileRuntime() {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return (
      window.location.protocol === "capacitor:" ||
      /Capacitor|Android/i.test(navigator.userAgent)
    );
  }
}

export function getApiBaseURL() {
  const configured = String(import.meta.env.VITE_PAL_API_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return DEPLOYED_API;
}
