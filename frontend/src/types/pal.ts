export type MarketDataStatus =
    | "CURRENT"
    | "RECENT"
    | "STALE"
    | "UNAVAILABLE"
    | string;

export interface MarketQuote {
    symbol: string;
    price: number | null;
    previous_price: number | null;
    change: number | null;
    change_percent: number | null;
    timestamp: string | null;
    source: string;
    status: MarketDataStatus;
    freshness_seconds: number | null;
    unit: string;
    reason: string | null;
}

export interface MacroBias {
    bias: string;
    score: number;
    confidence: number;
    reasons: string[];
    bullish?: boolean | null;
    bearish?: boolean | null;
}

export interface PALResponse {
    success: boolean;
    symbol: string;
    timestamp: string;
    report: {
        macro: {
            headline: string;
            summary: string;
            main_risk: string;
            confidence: number | null;
            dxy: MacroBias;
            gbp: MacroBias;
            gbpusd: MacroBias;
            events: Array<Record<string, unknown>>;
            news: Array<Record<string, unknown>>;
            usd_news: Array<Record<string, unknown>>;
            gbp_news: Array<Record<string, unknown>>;
            cross_news: Array<Record<string, unknown>>;
            bias_summary: string;
            markets: Record<string, MarketQuote>;
        };
        news: {
            summary: string;
            upcoming_events: Array<Record<string, unknown>>;
            recent_events: Array<Record<string, unknown>>;
            high_impact: Array<Record<string, unknown>>;
            warnings: string[];
            key_risk: string;
            headlines: Array<Record<string, unknown>>;
            usd: Array<Record<string, unknown>>;
            gbp: Array<Record<string, unknown>>;
            cross: Array<Record<string, unknown>>;
            macro_bias: Record<string, unknown>;
            markets: Record<string, MarketQuote>;
        };
        market_health?: {
            status: string;
            score: number;
            summary: string | null;
        };
        pal?: {
            overall_bias: string;
            execution_timeframe: string;
            ready_for_entry: boolean;
            workflow: Array<Record<string, unknown>>;
        };
        execution?: {
            action: string;
            trend: string;
            timeframe: string;
            stage: string;
            reason: string;
            confirmations: string[];
            summary: string;
        };
        ai_commentary?: {
            headline: string;
            summary: string;
            market_story: string;
            next_action: string;
            confidence: number;
            risk: string;
            reasoning: string[];
        };
        summary?: Record<string, unknown>;
    };
}
