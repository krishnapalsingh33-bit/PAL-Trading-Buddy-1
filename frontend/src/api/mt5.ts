import axios from "axios";

const mt5Api = axios.create({
    baseURL: import.meta.env.VITE_MT5_LOCAL_URL || "http://127.0.0.1:8765",
    timeout: 30000,
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

export type MT5Credentials = {
    login: number;
    password: string;
    server: string;
};

export async function fetchMT5Status(): Promise<MT5Status> {
    const response = await mt5Api.get<{ success: boolean; data: MT5Status }>(
        "/v2/mt5/status",
    );
    return response.data.data;
}

export async function connectMT5(
    credentials: MT5Credentials,
): Promise<MT5Status> {
    const response = await mt5Api.post<{
        success: boolean;
        data?: MT5Status;
        error?: string;
    }>("/v2/mt5/connect", credentials);

    if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || "MT5 connection failed.");
    }

    return response.data.data;
}
