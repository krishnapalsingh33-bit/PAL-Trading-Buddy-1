export interface NewsEvent {
    title: string;
    currency: string;
    impact: "High" | "Medium" | "Low" | string;
    time: string;
    forecast: string;
    previous: string;
}

export interface NewsData {
    events: NewsEvent[];
    total: number;
}

export interface NewsResponse {
    success: boolean;
    data: NewsData;
    error?: string;
}