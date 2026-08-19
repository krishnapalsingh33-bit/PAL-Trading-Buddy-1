import { useQuery } from "@tanstack/react-query";
import { fetchMT5Status } from "../api/mt5";

export function useMT5Status() {
    return useQuery({
        queryKey: ["mt5-status"],
        queryFn: fetchMT5Status,
        refetchInterval: 5000,
        retry: 1,
    });
}
