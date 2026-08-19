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

export interface TodayBiasLayer {
    bias: string;
    dxy: MacroBias;
    gbp: MacroBias;
    gbpusd: MacroBias;
    score: number;
    confidence: number;
    reasons: string[];
    evidence_count: number;
    scope: "TODAY_ONLY" | string;
    source: string;
    updated_at: string;
}

export interface TodaySessionBias {
    active: boolean;
    bias: string;
    score: number;
    confidence: number;
    reasons: string[];
    updated_at: string;
}

export interface TodayBiasReport {
    today: TodayBiasLayer;
    sessions: Record<string, TodaySessionBias>;
    active_session: string | null;
}

export interface MacroObservation {
    date?: string | null;
    period?: string | null;
    year?: string | null;
    value: number;
    source: string;
    dataset?: string;
}

export interface MacroDataSnapshot {
    fetched_at: string | null;
    source_status: Record<string, string>;
    observations: Record<string, MacroObservation[]>;
}

export interface PALResponse {
    success: boolean;
    symbol: string;
    timestamp: string;
    report: {
        // TODAY and MACRO are intentionally separate contracts.
        today: TodayBiasReport;
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
            macro_data?: MacroDataSnapshot;
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
            macro_data?: MacroDataSnapshot;
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
