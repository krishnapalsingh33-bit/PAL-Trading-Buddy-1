import axios from "axios";

const baseURL = import.meta.env.VITE_PAL_API_URL || "https://pal-trading-buddy-1.onrender.com";

const api = axios.create({
    baseURL,
    timeout: 120000,
    headers: {
        Accept: "application/json",
    },
});

export default api;
