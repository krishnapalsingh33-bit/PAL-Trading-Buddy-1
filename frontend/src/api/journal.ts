import axios from "axios";

const journalApi = axios.create({
    baseURL: import.meta.env.VITE_MT5_API_URL || import.meta.env.VITE_PAL_API_URL || "http://127.0.0.1:8000",
    timeout: 30000,
});

export async function fetchJournal(
    days: number = 30,
) {
    const response = await journalApi.get<{
        success: boolean;
        data: import("../types/journal").JournalData;
    }>(
        `/v2/journal?days=${days}`,
    );

    return response.data;
}
