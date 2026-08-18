import { useEffect, useState } from "react";

type Props = {
    tradeKey: string;
};

function storageKey(tradeKey: string) {
    return `pal.trade-screenshot.${tradeKey}`;
}

export default function TradeScreenshot({ tradeKey }: Props) {
    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
        try {
            setImage(window.localStorage.getItem(storageKey(tradeKey)));
        } catch {
            setImage(null);
        }
    }, [tradeKey]);

    function handleFile(file?: File) {
        if (!file || !file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : null;
            if (!result) return;
            try {
                window.localStorage.setItem(storageKey(tradeKey), result);
                setImage(result);
            } catch {
                // Keep the preview even if browser storage is full.
                setImage(result);
            }
        };
        reader.readAsDataURL(file);
    }

    function remove() {
        try {
            window.localStorage.removeItem(storageKey(tradeKey));
        } catch {
            // Ignore storage errors.
        }
        setImage(null);
    }

    return (
        <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-600">Trade Screenshot</p>
                    <p className="mt-1 text-sm text-zinc-400">Attach the chart screenshot for this trade.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15">
                    {image ? "Replace Screenshot" : "Add Screenshot"}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                </label>
            </div>

            {image ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-zinc-950">
                    <img src={image} alt="Trade chart screenshot" className="max-h-[520px] w-full object-contain" />
                    <div className="flex justify-end border-t border-white/[0.07] p-3">
                        <button
                            type="button"
                            onClick={remove}
                            className="rounded-lg border border-red-400/15 bg-red-400/5 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/10"
                        >
                            Remove Screenshot
                        </button>
                    </div>
                </div>
            ) : (
                <label className="mt-4 flex min-h-40 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-zinc-950/60 px-6 text-center transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.03]">
                    <span>
                        <span className="block text-sm font-medium text-zinc-300">Drop or choose a chart screenshot</span>
                        <span className="mt-1 block text-xs text-zinc-600">PNG, JPG or WEBP · stored locally with this trade</span>
                    </span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                </label>
            )}
        </section>
    );
}
