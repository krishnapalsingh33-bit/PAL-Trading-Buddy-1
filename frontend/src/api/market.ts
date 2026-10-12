import axios from "axios";
import { isDesktopPAL, palApiBaseURL } from "./pal";

const configuredMarketURL = String(import.meta.env.VITE_PAL_MARKET_API_URL || "").trim();
const marketURL = configuredMarketURL.replace(/\/+$/, "") ||
  (isDesktopPAL ? palApiBaseURL : "https://pal-market-data-api.onrender.com");

/**
 * Quotes have a dedicated read-only API origin so browser quote fetches do not
 * depend on the separate PAL analysis service. Desktop continues using its
 * bundled local backend.
 */
const marketApi = axios.create({
  baseURL: marketURL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

export const palMarketApiBaseURL = marketURL;
export default marketApi;
