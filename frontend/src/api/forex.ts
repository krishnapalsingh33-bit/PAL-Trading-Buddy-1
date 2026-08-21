import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_PAL_API_URL || "http://127.0.0.1:8000",
  timeout: 30000,
});

export type ForexPair = {
  symbol: string;
  label: string;
  base_currency: string;
  quote_currency: string;
};

export type ForexTimeframe = {
  timeframe: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  confidence: number;
  price: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;
  reason: string;
  timestamp: string | null;
  candles: Array<{ time: string; open: number | null; high: number | null; low: number | null; close: number | null }>;
};

export type ForexIntelligence = {
  symbol: string;
  label: string;
  base_currency: string;
  quote_currency: string;
  overall_bias: string;
  confidence: number;
  supported_pairs: number;
  source: string;
  timestamp: string;
  timeframes: Record<string, ForexTimeframe>;
};

export type ForexEvent = {
  title: string;
  currency: string;
  time: string;
  impact: string;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
  source?: string;
};

export type ForexHeadline = {
  id?: string;
  title: string;
  currency?: string;
  source?: string;
  published_at?: string;
  url?: string;
};

export type ForexMarketResponse = {
  success: boolean;
  symbol: string;
  label: string;
  technical: ForexIntelligence;
  news: {
    currencies: string[];
    upcoming_events: ForexEvent[];
    headlines: ForexHeadline[];
  };
  timestamp: string;
};

export async function fetchForexPairs(): Promise<ForexPair[]> {
  const response = await api.get<{ success: boolean; count: number; pairs: ForexPair[] }>("/v2/market/forex/pairs");
  return response.data.pairs;
}

export async function fetchForexMarket(symbol: string): Promise<ForexMarketResponse> {
  const response = await api.get<ForexMarketResponse>(`/v2/market/forex/${symbol}`);
  return response.data;
}
