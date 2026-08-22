import { useQuery } from "@tanstack/react-query";
import api from "../api/pal";
import type { PALResponse } from "../types/pal";

async function fetchPAL(): Promise<PALResponse> {
    const { data } = await api.get<PALResponse>("/pal/analyze/GBPUSD");
    return data;
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
