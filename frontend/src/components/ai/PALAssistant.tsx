import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/pal";
import { auth } from "../../auth/firebase";

type ChatMessage = { role: "user" | "assistant"; text: string };
type Props = { context: Record<string, unknown>; title?: string; subtitle?: string; accent?: "cyan" | "emerald"; quickPrompts?: string[] };

const DEFAULT_PROMPTS = ["What is today's brief?", "Explain the current bias", "What news matters today?"];
const ACCENT = {
  cyan: { header: "bg-cyan-300/[.04]", label: "text-cyan-300", chip: "border-cyan-300/15 bg-cyan-300/[.05] text-cyan-200 hover:bg-cyan-300/[.10]", user: "bg-cyan-300/[.10] text-cyan-100 border-cyan-300/15", button: "bg-cyan-300", icon: "border-cyan-300/25 text-cyan-300" },
  emerald: { header: "bg-emerald-300/[.04]", label: "text-emerald-300", chip: "border-emerald-300/15 bg-emerald-300/[.05] text-emerald-200 hover:bg-emerald-300/[.10]", user: "bg-emerald-300/[.10] text-emerald-100 border-emerald-300/15", button: "bg-emerald-300", icon: "border-emerald-300/25 text-emerald-300" },
} as const;

export default function PALAssistant({ context, title = "PAL Intelligence", subtitle = "Ask about the live evidence", accent = "cyan", quickPrompts = DEFAULT_PROMPTS }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const tone = ACCENT[accent];

  const contextPayload = useMemo(() => {
    const source = context as Record<string, any>;
    const compact: Record<string, any> = { ...source };
    if (Array.isArray(compact.news)) compact.news = compact.news.slice(0, 12);
    if (Array.isArray(compact.journal)) compact.journal = compact.journal.slice(-20);
    if (Array.isArray(compact.events)) compact.events = compact.events.slice(0, 12);
    if (compact.macro && typeof compact.macro === "object") {
      compact.macro = { ...compact.macro };
      if (Array.isArray(compact.macro.news)) compact.macro.news = compact.macro.news.slice(0, 12);
      if (Array.isArray(compact.macro.events)) compact.macro.events = compact.macro.events.slice(0, 12);
    }
    return compact;
  }, [context]);

  const usedPrompts = useMemo(() => new Set(messages.filter((message) => message.role === "user").map((message) => message.text)), [messages]);
  const remainingPrompts = useMemo(() => quickPrompts.filter((prompt) => !usedPrompts.has(prompt)), [quickPrompts, usedPrompts]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean || loading) return;
    setInput(""); setError("");
    const nextMessages = [...messages, { role: "user" as const, text: clean }];
    setMessages(nextMessages); setLoading(true);
    try {
      const token = await auth?.currentUser?.getIdToken().catch(() => undefined);
      const response = await api.post("/pal/assistant", { question: clean, context: contextPayload, history: nextMessages.slice(-8) }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      setMessages((current) => [...current, { role: "assistant", text: String(response.data?.answer ?? "PAL could not produce an answer from the supplied evidence.") }]);
    } catch (err: any) {
      const detail = String(err?.response?.data?.detail ?? err?.message ?? "Assistant unavailable");
      setError(detail);
      setMessages((current) => [...current, { role: "assistant", text: "I could not reach the PAL intelligence service. Check the backend and AI provider configuration, then try again." }]);
    } finally { setLoading(false); }
  };

  return <>
    {open ? <div className="fixed bottom-5 right-5 z-[260] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-white/10 bg-[#07100f]/95 shadow-[0_30px_100px_rgba(0,0,0,.65)] backdrop-blur-xl">
      <div className={`border-b border-white/[.07] ${tone.header} px-4 py-3`}><div className="flex items-center justify-between gap-3"><div><div className={`text-[9px] font-bold uppercase tracking-[.22em] ${tone.label}`}>{title}</div><div className="mt-1 text-[10px] text-zinc-500">{subtitle}</div></div><button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded-xl border border-white/[.07] text-zinc-500 hover:text-white">×</button></div></div>
      <div className="max-h-[430px] min-h-[210px] space-y-3 overflow-y-auto p-4">
        {!messages.length ? <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4"><div className="text-sm font-semibold text-white">Evidence-first assistant</div><p className="mt-2 text-[11px] leading-5 text-zinc-500">I use PAL's current market, macro, news and journal context. I will say when the data is insufficient instead of inventing a bias.</p><div className="mt-4 flex flex-wrap gap-2">{quickPrompts.slice(0,1).map(prompt=><button key={prompt} type="button" onClick={()=>void ask(prompt)} className={`rounded-full border px-3 py-1.5 text-[9px] ${tone.chip}`}>{prompt}</button>)}</div></div> : null}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`flex ${message.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-[11px] leading-5 ${message.role==="user"?tone.user:"border border-white/[.06] bg-white/[.025] text-zinc-300"}`}>{message.text}</div></div>)}
        {!loading && messages.length > 0 && remainingPrompts.length > 0 ? <div className="pt-1"><div className="mb-2 text-[8px] uppercase tracking-[.18em] text-zinc-700">Next questions</div><div className="flex flex-wrap gap-2">{remainingPrompts.slice(0,4).map(prompt=><button key={prompt} type="button" onClick={()=>void ask(prompt)} className={`rounded-full border px-3 py-1.5 text-[9px] ${tone.chip}`}>{prompt}</button>)}</div></div> : null}
        {loading ? <div className="text-[10px] text-zinc-600"><span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"/>PAL is reading the current evidence…</div> : null}<div ref={endRef}/>
      </div>
      {error ? <div className="border-t border-red-300/10 bg-red-300/[.03] px-4 py-2 text-[9px] text-red-300/80">{error}</div> : null}
      <form onSubmit={event=>{event.preventDefault();void ask(input)}} className="border-t border-white/[.07] p-3"><div className="flex items-center gap-2 rounded-2xl border border-white/[.08] bg-black/30 p-1.5"><input value={input} onChange={event=>setInput(event.target.value)} placeholder="Ask PAL anything about the evidence…" className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-white outline-none placeholder:text-zinc-700"/><button type="submit" disabled={!input.trim()||loading} className={`rounded-xl ${tone.button} px-3 py-2 text-[10px] font-bold text-[#031014] disabled:opacity-30`}>Ask</button></div></form>
    </div> : null}
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-label="Open PAL Intelligence" className={`fixed bottom-5 right-5 z-[250] flex h-14 w-14 items-center justify-center rounded-2xl border ${tone.icon} bg-[#07120f]/95 shadow-[0_12px_50px_rgba(0,0,0,.5),0_0_30px_rgba(32,217,255,.10)] backdrop-blur-xl transition hover:-translate-y-1`}><span className="relative text-xl">✦<span className="absolute -right-2 -top-1 h-2 w-2 animate-ping rounded-full bg-emerald-300/70"/></span></button>
  </>;
}
