import {
    useQuery,
} from "@tanstack/react-query";

import {
    fetchNews,
} from "../api/news";

export function useNews() {
    return useQuery({
        queryKey: ["news"],
        queryFn: fetchNews,
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
    });
}