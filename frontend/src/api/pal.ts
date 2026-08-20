import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_PAL_API_URL || "http://127.0.0.1:8000",
    timeout: 30000,
});

export default api;
