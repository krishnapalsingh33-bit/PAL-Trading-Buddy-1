import axios from "axios";

function getBaseURL() {
    const configured = String(import.meta.env.VITE_PAL_API_URL || "").trim();
    if (configured) return configured;

    // Native Android cannot reach the developer machine through 127.0.0.1.
    // For local Android/BlueStacks testing, use the Android emulator host alias.
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) return "http://10.0.2.2:8000";

    return "http://127.0.0.1:8000";
}

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 120000,
    headers: {
        Accept: "application/json",
    },
});

export default api;
