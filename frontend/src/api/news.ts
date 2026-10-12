import api from "./pal";
import type { NewsData, NewsResponse } from "../types/news";

/** Use the configured PAL base URL for browser, hosted, and desktop builds. */
export async function fetchNews(): Promise<NewsData> {
  const response = await api.get<NewsResponse>("/v2/news");
  if (!response.data.success) {
    throw new Error(response.data.error || "Failed to load news.");
  }
  return response.data.data;
}
