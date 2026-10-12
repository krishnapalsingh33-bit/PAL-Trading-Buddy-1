import axios from "axios";
import { isDesktopPAL, palApiBaseURL } from "./pal";

const configuredMarketURL = String(import.meta.env.VITE_PAL_MARKET_API_URL || "").trim();

/**
 * Dedicated read-only quote service. This host has now been created on Render.
 * Desktop still uses its bundled local PAL service unless explicitly overridden.
 */
const marketURL =
  configuredMarketURL.replace(/\/+$/, "") ||
  (isDesktopPAL ? palApiBaseURL : "https://pal-market-data-api.onrender.com");

const marketApi = axios.create({
  baseURL: marketURL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

export const palMarketApiBaseURL = marketURL;
export default marketApi;
