import { useEffect, useState } from "react";
import Badge from "../ui/Badge";

export type Page = "dashboard" | "journal" | "forex" | "macro-desk" | "macro-view" | "macro-calendar" | "reports";
type Brightness = "low" | "medium" | "high";
type Props = { symbol: string; activePage?: Page; onPageChange?(page: Page): void };

const NAV_ITEMS: Array<{ page: Page; label: string; icon: string }> = [
  { page: "dashboard", label: "Dashboard", icon: "⌂" },
  { page: "journal", label: "Journal", icon: "▣" },
  { page: "forex", label: "Forex", icon: "⌁" },
  { page: "macro-desk", label: "Macro Desk", icon: "✦" },
  { page: "macro-view", label: "Macro View", icon: "◈" },
  { page: "macro-calendar", label: "Macro Calendar", icon: "□" },
  { page: "reports", label: "Daily Reports", icon: "▤" },
];

const TABS = ["General", "Appearance", "Notifications", "Security", "Data & Privacy", "About PAL"] as const;
type SettingsTab = (typeof TABS)[number];

export default function Sidebar({ symbol, activePage = "dashboard", onPageChange }: Props) {
  const [brightness, setBrightness] = useState<Brightness>("medium");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("General");

  useEffect(() => {
    const saved = window.localStorage.getItem("pal-sidebar-brightness") as Brightness | null;
    if (saved === "low" || saved === "medium" || saved === "high") setBrightness(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palBrightness = brightness;
    window.localStorage.setItem("pal-sidebar-brightness", brightness);
  }, [brightness]);

  const navigate = (page: Page) => {
    onPageChange?.(page);
    window.location.hash = page;
  };

  return (
    <>
      <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col border-r border-cyan-300/[.07] bg-[#020811]">
        <div className="border-b border-white/[.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[.05] text-2xl text-cyan-300">⌁</div>
            <div>
              <h1 className="text-[25px] font-semibold text-white">PAL</h1>
              <p className="text-[12px] text-zinc-500">Trading Buddy</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => navigate(item.page)}
                className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-cyan-300/35 bg-emerald-300/[.10] text-white shadow-[0_0_24px_rgba(32,217,255,.08)]"
                    : "border-transparent text-zinc-400 hover:border-white/[.06] hover:bg-white/[.025] hover:text-white"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-cyan-300/[.10] text-cyan-300" : "text-emerald-300/75"}`}>
                  {item.icon}
                </span>
                <span className="text-[14px] font-medium">{item.label}</span>
                {active ? <span className="ml-auto text-cyan-300">›</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/[.06] px-5 py-4">
          <div className="mb-4">
            <p className="mb-2 text-[9px] uppercase tracking-[.2em] text-zinc-600">Active Symbol</p>
            <Badge text={symbol} />
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[.2em] text-zinc-600">Theme</p>
              <span className="text-[8px] font-bold text-cyan-300/70">{brightness.toUpperCase()}</span>
            </div>
            <div className="flex gap-1.5 rounded-xl border border-white/[.06] bg-white/[.018] p-1">
              {(["low", "medium", "high"] as Brightness[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBrightness(value)}
                  className={`flex h-8 flex-1 items-center justify-center rounded-lg ${brightness === value ? "bg-cyan-300/[.12] text-cyan-300" : "text-zinc-600 hover:text-zinc-300"}`}
                >
                  {value === "low" ? "◐" : value === "medium" ? "☼" : "☾"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTab("General");
              setSettingsOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-3 text-left text-zinc-400 transition hover:border-cyan-300/25 hover:text-white"
          >
            <span>⚙</span>
            <span className="text-[11px] font-semibold">Settings</span>
            <span className="ml-auto">›</span>
          </button>
        </div>
      </aside>

      {settingsOpen ? (
        <SettingsModal tab={tab} setTab={setTab} brightness={brightness} setBrightness={setBrightness} symbol={symbol} close={() => setSettingsOpen(false)} />
      ) : null}
    </>
  );
}

function SettingsModal({
  tab,
  setTab,
  brightness,
  setBrightness,
  symbol,
  close,
}: {
  tab: SettingsTab;
  setTab: (tab: SettingsTab) => void;
  brightness: Brightness;
  setBrightness: (value: Brightness) => void;
  symbol: string;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="mx-auto flex h-full max-w-[1120px] overflow-hidden rounded-3xl border border-white/[.09] bg-[#080d12] shadow-[0_40px_120px_rgba(0,0,0,.75)]">
        <div className="hidden w-[250px] shrink-0 border-r border-white/[.07] bg-black/20 p-4 sm:block">
          <div className="px-3 py-4">
            <div className="text-lg font-semibold text-white">Settings</div>
            <div className="mt-1 text-[10px] text-zinc-600">PAL Trading Buddy</div>
          </div>
          {TABS.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`mb-1 flex w-full items-center rounded-xl px-3 py-3 text-left text-[11px] transition ${tab === item ? "bg-white/[.06] text-white" : "text-zinc-500 hover:bg-white/[.03] hover:text-zinc-200"}`}>
              {item}
            </button>
          ))}
          <div className="mt-6 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.03] p-3">
            <div className="text-[10px] font-semibold text-emerald-300">● System operational</div>
            <p className="mt-2 text-[9px] leading-4 text-zinc-600">PAL market intelligence is running.</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[.07] bg-[#080d12]/95 px-6 py-5 backdrop-blur-xl">
            <div>
              <div className="text-[9px] uppercase tracking-[.22em] text-cyan-300/70">PAL System</div>
              <h2 className="mt-1 text-xl font-semibold text-white">{tab}</h2>
            </div>
            <button type="button" onClick={close} className="h-9 w-9 rounded-xl border border-white/[.07] text-zinc-500 hover:text-white">×</button>
          </header>

          <div className="p-6">
            {tab === "General" ? <GeneralSettings symbol={symbol} /> : null}
            {tab === "Appearance" ? <AppearanceSettings brightness={brightness} setBrightness={setBrightness} /> : null}
            {tab === "Notifications" ? <NotificationsSettings /> : null}
            {tab === "Security" ? <SecuritySettings /> : null}
            {tab === "Data & Privacy" ? <PrivacySettings /> : null}
            {tab === "About PAL" ? <AboutSettings /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralSettings({ symbol }: { symbol: string }) {
  return (
    <div className="space-y-4">
      <Panel title="Workspace">
        <Field label="Default symbol" value={symbol} />
        <Field label="Start page" value="Dashboard" />
      </Panel>
      <Toggle title="Remember my last page" text="Return to the page you were using when PAL closed." on />
      <Toggle title="Compact information density" text="Fit more information on screen." />
    </div>
  );
}

function AppearanceSettings({ brightness, setBrightness }: { brightness: Brightness; setBrightness: (value: Brightness) => void }) {
  return (
    <div className="space-y-4">
      <Panel title="Theme">
        <div className="grid grid-cols-3 gap-3">
          {(["low", "medium", "high"] as Brightness[]).map((value) => (
            <button key={value} type="button" onClick={() => setBrightness(value)} className={`rounded-2xl border p-4 text-left ${brightness === value ? "border-cyan-300/30 bg-cyan-300/[.06]" : "border-white/[.06] bg-black/20"}`}>
              <div className="text-lg">{value === "low" ? "◐" : value === "medium" ? "☼" : "☾"}</div>
              <div className="mt-2 text-xs font-semibold text-white">{value[0].toUpperCase() + value.slice(1)}</div>
              <div className="mt-1 text-[9px] text-zinc-600">Interface brightness</div>
            </button>
          ))}
        </div>
      </Panel>
      <Toggle title="Motion effects" text="Use subtle live-state transitions." on />
      <Toggle title="Reduce motion" text="Reduce animation for accessibility." />
    </div>
  );
}

function NotificationsSettings() {
  return <div className="space-y-3"><Toggle title="Daily market report" text="Daily macro briefing notifications." on /><Toggle title="London briefing" text="London session briefing." on /><Toggle title="New York briefing" text="New York session briefing." on /><Toggle title="High-impact events" text="Major calendar releases." on /></div>;
}

function SecuritySettings() {
  return (
    <Panel title="PAL Account">
      <p className="text-xs text-zinc-500">Sign in to use PAL. Google sign-in uses Google OAuth; PAL never needs your Gmail password.</p>
      <button type="button" className="mt-5 w-full rounded-xl border border-white/[.08] bg-white/[.05] px-4 py-3 text-xs font-semibold text-white">Continue with Google</button>
      <div className="my-4 text-center text-[9px] uppercase tracking-widest text-zinc-700">or email + PAL password</div>
      <input type="email" placeholder="Email address" className="w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white" />
      <input type="password" placeholder="PAL password" className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/30 px-3 py-3 text-xs text-white" />
      <button type="button" className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 text-xs font-bold text-[#031014]">Sign in</button>
      <p className="mt-3 text-[9px] leading-4 text-zinc-600">Authentication is configured separately through Firebase.</p>
    </Panel>
  );
}

function PrivacySettings() {
  return <div className="space-y-3"><Toggle title="Provider freshness" text="Show source and freshness status." on /><Toggle title="Local preferences" text="Store theme preferences in this browser." on /></div>;
}

function AboutSettings() {
  return (
    <Panel title="PAL Trading Buddy">
      <p className="text-xs text-zinc-500">AI market intelligence workspace.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Version', '0.1'], ['Frontend', 'React 19'], ['Data', 'Provider-backed'], ['Status', 'Operational']].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[.06] p-3"><div className="text-[9px] uppercase text-zinc-700">{label}</div><div className="mt-1 text-xs font-semibold text-zinc-300">{value}</div></div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><div className="mt-4">{children}</div></div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 block text-[10px] text-zinc-500">{label}<input readOnly value={value} className="mt-2 w-full rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs text-white" /></label>;
}

function Toggle({ title, text, on = false }: { title: string; text: string; on?: boolean }) {
  const [enabled, setEnabled] = useState(on);
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.02] p-4">
      <div><div className="text-xs font-semibold text-zinc-200">{title}</div><div className="mt-1 text-[10px] text-zinc-600">{text}</div></div>
      <button type="button" onClick={() => setEnabled((value) => !value)} className={`relative h-6 w-11 rounded-full ${enabled ? "bg-cyan-300/80" : "bg-zinc-800"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} /></button>
    </div>
  );
}
