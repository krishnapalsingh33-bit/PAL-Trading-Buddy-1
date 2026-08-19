import axios from "axios";

const mt5Api = axios.create({
    baseURL: import.meta.env.VITE_MT5_LOCAL_URL || "http://127.0.0.1:8765",
    timeout: 10000,
});

export type MT5Status = {
    status: "CONNECTED" | "NOT_CONNECTED" | "UNAVAILABLE" | "ERROR";
    connected: boolean;
    reason: string | null;
    account: {
        login: number;
        server: string;
        name: string;
        currency: string;
        balance: number;
        equity: number;
    } | null;
    terminal: {
        community_account: boolean;
        trade_allowed: boolean;
        connected: boolean;
    } | null;
};

export async function fetchMT5Status(): Promise<MT5Status> {
    const response = await mt5Api.get<{ success: boolean; data: MT5Status }>(
        "/v2/mt5/status",
    );
    return response.data.data;
}
