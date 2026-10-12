import axios from "axios";
import { isDesktopPAL, palApiBaseURL } from "./pal";

const configuredMarketURL = String(import.meta.env.VITE_PAL_MARKET_API_URL || "").trim();

/**
 * Use the existing PAL backend by default. Only point to the dedicated
 * quote-only service after that service has actually been deployed and its
 * health endpoint verified. This avoids shipping a guaranteed-dead hostname.
 * Desktop always uses its bundled local API unless explicitly overridden.
 */
const marketURL =
  configuredMarketURL.replace(/\/+$/, "") ||
  palApiBaseURL;

const marketApi = axios.create({
  baseURL: marketURL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

export const palMarketApiBaseURL = marketURL;
export default marketApi;
