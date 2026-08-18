import { useEffect, useMemo, useState } from "react";
import { useJournal } from "../../hooks/useJournal";
import type { JournalTrade } from "../../types/journal";

const DB_NAME = "pal-trading-buddy-journal";
const STORE_NAME = "trade-screenshots";
const MAX_SCREENSHOTS = 4;

interface ScreenshotRecord { id: string; tradeId: number; name: string; type: string; dataUrl: string; createdAt: string; }

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE_NAME)) { const store = db.createObjectStore(STORE_NAME, { keyPath: "id" }); store.createIndex("tradeId", "tradeId", { unique: false }); } };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open screenshot storage."));
    });
}
async function readScreenshots(tradeId: number): Promise<ScreenshotRecord[]> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).index("tradeId").getAll(tradeId); request.onsuccess = () => resolve((request.result as ScreenshotRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt))); request.onerror = () => reject(request.error ?? new Error("Could not read screenshots.")); }); }
async function writeScreenshot(record: ScreenshotRecord): Promise<void> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error ?? new Error("Could not save screenshot.")); }); }
async function deleteScreenshot(id: string): Promise<void> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error ?? new Error("Could not delete screenshot.")); }); }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error ?? new Error("Could not read image.")); reader.readAsDataURL(file); }); }
function TradeSelect({ trades, selectedId, onChange }: { trades: JournalTrade[]; selectedId: number | null; onChange: (id: number) => void }) { return <select value={selectedId ?? ""} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-emerald-400/40"><option value="">Select a trade…</option>{trades.map((trade) => <option key={trade.position_id} value={trade.position_id}>{trade.symbol} · {trade.direction.toUpperCase()} · {new Date(trade.exit_time).toLocaleString()}</option>)}</select>; }

export default function JournalScreenshots() {
    const { data } = useJournal(365);
    const trades = useMemo(() => data?.data?.trades ?? [], [data]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    useEffect(() => { if (selectedId == null && trades.length) setSelectedId(trades[0].position_id); }, [selectedId, trades]);
    useEffect(() => { if (selectedId == null) { setScreenshots([]); return; } readScreenshots(selectedId).then(setScreenshots).catch((error) => setMessage(error instanceof Error ? error.message : "Screenshot storage unavailable.")); }, [selectedId]);
    const selectedTrade = trades.find((trade) => trade.position_id === selectedId);
    async function addFiles(files: FileList | null) { if (!selectedId || !files?.length) return; const remaining = MAX_SCREENSHOTS - screenshots.length; const images = Array.from(files).filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type)).slice(0, remaining); if (!images.length) { setMessage("Use PNG, JPG or WEBP screenshots."); return; } setBusy(true); setMessage(""); try { const next: ScreenshotRecord[] = []; for (const file of images) { const record: ScreenshotRecord = { id: `${selectedId}-${Date.now()}-${Math.random().toString(36).slice(2)}`, tradeId: selectedId, name: file.name, type: file.type, dataUrl: await fileToDataUrl(file), createdAt: new Date().toISOString() }; await writeScreenshot(record); next.push(record); } setScreenshots((current) => [...current, ...next]); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save screenshot."); } finally { setBusy(false); } }
    async function remove(id: string) { await deleteScreenshot(id); setScreenshots((current) => current.filter((item) => item.id !== id)); }
    return (
        <section className="mt-0 rounded-2xl border border-white/[0.08] bg-zinc-900/75 p-6 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/70">Trade Review</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Trade Screenshots</h2><p className="mt-1 text-sm text-zinc-500">Attach up to 4 persistent chart screenshots to each journal trade.</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-xs text-zinc-500">{screenshots.length}/{MAX_SCREENSHOTS} saved</div></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><div><label className="mb-2 block text-xs uppercase tracking-wider text-zinc-600">Trade</label><TradeSelect trades={trades} selectedId={selectedId} onChange={setSelectedId} />{selectedTrade && <p className="mt-2 text-xs text-zinc-600">{selectedTrade.symbol} · {selectedTrade.direction.toUpperCase()} · {selectedTrade.result}</p>}</div><label className={`inline-flex cursor-pointer items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium transition ${screenshots.length >= MAX_SCREENSHOTS || busy || !selectedId ? "cursor-not-allowed border-white/[0.05] text-zinc-700" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"}`}>{busy ? "Saving…" : "＋ Add Screenshot"}<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" disabled={screenshots.length >= MAX_SCREENSHOTS || busy || !selectedId} onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }} /></label></div>
            {message && <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3 text-sm text-amber-200/80">{message}</div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">{screenshots.map((shot, index) => <div key={shot.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-950"><div className="aspect-video bg-black"><img src={shot.dataUrl} alt={`Trade screenshot ${index + 1}`} className="h-full w-full object-contain" /></div><div className="flex items-center justify-between gap-3 p-3"><span className="truncate text-xs text-zinc-500">Screenshot {index + 1} · {shot.name}</span><button type="button" onClick={() => void remove(shot.id)} className="rounded-lg border border-red-400/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-400/10">Remove</button></div></div>)}{!screenshots.length && <div className="sm:col-span-2 rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-zinc-600">No screenshots attached to this trade yet.</div>}</div>
        </section>
    );
}
