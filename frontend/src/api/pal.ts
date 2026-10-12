import axios from "axios";

// The desktop shell starts the bundled FastAPI service on localhost:8000.
// Do not send desktop API calls to the hosted web service: that service may be
// unavailable/offline and will not contain the user's local desktop runtime.
const isElectronRenderer =
    typeof navigator !== "undefined" &&
    /Electron/i.test(navigator.userAgent);

const configuredBaseURL = String(import.meta.env.VITE_PAL_API_URL || "").trim();
const normalizedConfiguredURL = configuredBaseURL.replace(/\/+$/, "");

const baseURL =
    normalizedConfiguredURL ||
    (isElectronRenderer
        ? "http://127.0.0.1:8000"
        : "https://pal-trading-buddy-1.onrender.com");

const api = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
        Accept: "application/json",
    },
});

// Export connection metadata for diagnostics without exposing any credentials.
export const palApiBaseURL = baseURL;
export const isDesktopPAL = isElectronRenderer;

export async function checkPALApi(): Promise<{
    connected: boolean;
    baseURL: string;
    status: string;
    message: string;
}> {
    try {
        const { data } = await api.get<{ status?: string }>("/health", {
            timeout: 5000,
        });
        return {
            connected: true,
            baseURL,
            status: String(data?.status || "reachable").toUpperCase(),
            message: "PAL API reachable",
        };
    } catch (error) {
        const message =
            axios.isAxiosError(error) && error.code === "ECONNABORTED"
                ? "PAL API health check timed out"
                : axios.isAxiosError(error) && error.response
                  ? `PAL API returned HTTP ${error.response.status}`
                  : "Cannot reach PAL API at the configured address";
        return {
            connected: false,
            baseURL,
            status: "UNAVAILABLE",
            message,
        };
    }
}

export default api;
