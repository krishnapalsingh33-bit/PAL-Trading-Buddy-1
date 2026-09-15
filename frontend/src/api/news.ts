import axios from "axios";
import type { NewsData, NewsResponse } from "../types/news";

function getBaseURL() {
  const configured = String(import.meta.env.VITE_PAL_API_URL || "").trim();
  if (configured) return configured;
  return "https://pal-trading-buddy-1.onrender.com";
}

const newsApi = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
});

export async function fetchNews(): Promise<NewsData> {
  const response = await newsApi.get<NewsResponse>("/v2/news");

  if (!response.data.success) {
    throw new Error(response.data.error || "Failed to load news.");
  }

  return response.data.data;
}
