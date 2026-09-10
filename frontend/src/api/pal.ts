import axios from "axios";

function getBaseURL() {
    const configured = String(import.meta.env.VITE_PAL_API_URL || "").trim();
    if (configured) return configured;

    // Mobile and web builds use the deployed PAL backend by default.
    return "https://pal-trading-buddy-1.onrender.com";
}

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 120000,
    headers: {
        Accept: "application/json",
    },
});

export default api;
