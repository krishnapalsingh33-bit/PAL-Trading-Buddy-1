import axios from "axios";
import { getApiBaseURL } from "./runtime";

const api = axios.create({
    baseURL: getApiBaseURL(),
    timeout: 120000,
    headers: {
        Accept: "application/json",
    },
});

export default api;
