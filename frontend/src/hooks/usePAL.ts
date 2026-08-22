import { useQuery } from "@tanstack/react-query";
import api from "../api/pal";
import type { PALResponse } from "../types/pal";

const REQUEST_TIMEOUT_MS = 10000;

async function fetchPAL(): Promise<PALResponse> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const { data } = await api.get<PALResponse>("/pal/analyze/GBPUSD", {
            signal: controller.signal,
        });
        return data;
    } finally {
        window.clearTimeout(timeout);
    }
}

export function usePAL() {
    return useQuery({
        queryKey: ["pal"],
        queryFn: fetchPAL,
        refetchInterval: () => document.visibilityState === "visible" ? 15000 : 300000,
        refetchOnWindowFocus: true,
        retry: 1,
        staleTime: 10000,
    });
}
