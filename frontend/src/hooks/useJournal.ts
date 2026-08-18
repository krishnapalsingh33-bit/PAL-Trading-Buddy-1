import { useQuery } from "@tanstack/react-query";

import { fetchJournal } from "../api/journal";


export function useJournal(
    days: number = 30,
) {
    return useQuery({
        queryKey: [
            "journal",
            days,
        ],

        queryFn: () => fetchJournal(days),

        refetchInterval: 5000,
    });
}