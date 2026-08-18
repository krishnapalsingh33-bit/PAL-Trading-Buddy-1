import axios from "axios";
import type {
    NewsData,
    NewsResponse,
} from "../types/news";

const newsApi = axios.create({
    baseURL: "http://127.0.0.1:8000",
    timeout: 30000,
});

export async function fetchNews(): Promise<NewsData> {
    const response = await newsApi.get<NewsResponse>(
        "/v2/news",
    );

    if (!response.data.success) {
        throw new Error(
            response.data.error || "Failed to load news.",
        );
    }

    return response.data.data;
}