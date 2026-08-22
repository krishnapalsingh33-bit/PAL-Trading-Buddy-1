import axios from "axios";

const baseURL = import.meta.env.VITE_PAL_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
        Accept: "application/json",
    },
});

export default api;
