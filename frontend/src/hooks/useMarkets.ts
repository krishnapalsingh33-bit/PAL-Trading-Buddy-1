import { useQuery } from "@tanstack/react-query";
import marketApi from "../api/market";

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
  unit?: string;
  reason: string | null;
  right_now_status?: string;
};

export type ProviderStatus = {
  name: string;
  configured: boolean;
  status: "RESPONDING" | "NO_USABLE_QUOTES" | string;
  fresh_quotes: number;
  usable_quotes: number;
  expected_quotes: number;
};

export type LiveMarketResponse = {
  success: boolean;
  status: "CONNECTED" | "CONNECTED_WITH_RECENT_QUOTES" | "PARTIAL" | "UNAVAILABLE" | string;
  timestamp: string;
  provider: ProviderStatus;
  markets: Record<string, LiveMarketQuote>;
};

async function fetchMarkets(): Promise<LiveMarketResponse> {
  const { data } = await marketApi.get<LiveMarketResponse>("/pal/markets");
  return data;
}

/** Quotes refresh independently from the slower macro/news analysis request. */
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
