import { useQuery } from "@tanstack/react-query";
import api from "../api/pal";

export type LiveMarketQuote = {
  symbol: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  timestamp: string | null;
  source: string;
  status: "CURRENT" | "RECENT" | "STALE" | "UNAVAILABLE" | string;
  freshness_seconds: number | null;
  unit: string;
  reason: string | null;
};

type LiveMarketResponse = {
  success: boolean;
  timestamp: string;
  markets: Record<string, LiveMarketQuote>;
};

async function fetchMarkets(): Promise<LiveMarketResponse> {
  const { data } = await api.get<LiveMarketResponse>("/pal/markets");
  return data;
}

/** Lightweight independent quote polling; slower analysis/news polling remains separate. */
export function useMarkets() {
  return useQuery({
    queryKey: ["pal-markets"],
    queryFn: fetchMarkets,
    refetchInterval: () => document.visibilityState === "visible" ? 15_000 : 300_000,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 5_000,
  });
}
