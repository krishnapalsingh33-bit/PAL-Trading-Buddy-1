import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchJournal } from "../api/journal";

export function useJournal(days: number = 30) {
    const query = useQuery({
        queryKey: ["journal", days],
        queryFn: () => fetchJournal(days),
        refetchInterval: 5000,
        staleTime: 0,
    });

    useEffect(() => {
        const refreshAfterMT5Connect = () => {
            void query.refetch();
        };

        window.addEventListener("pal:mt5-connected", refreshAfterMT5Connect);
        return () => {
            window.removeEventListener("pal:mt5-connected", refreshAfterMT5Connect);
        };
    }, [query.refetch]);

    return query;
}
