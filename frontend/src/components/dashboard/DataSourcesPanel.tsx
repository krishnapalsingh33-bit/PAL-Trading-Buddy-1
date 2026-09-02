const SOURCES = [
  ["News", "Google News", "https://news.google.com/"],
  ["Macro news", "GDELT", "https://www.gdeltproject.org/"],
  ["Economic calendar", "Forex Factory", "https://www.forexfactory.com/calendar"],
  ["US releases", "BLS", "https://www.bls.gov/schedule/news_release/"],
  ["Fed schedule", "Federal Reserve", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"],
  ["US yields", "U.S. Treasury", "https://home.treasury.gov/resource-center/data-chart-center/interest-rates"],
  ["Macro series", "FRED", "https://fred.stlouisfed.org/"],
  ["UK releases", "UK ONS", "https://www.ons.gov.uk/releasecalendar"],
  ["Market quotes", "Yahoo Finance", "https://finance.yahoo.com/"],
] as const;

export default function DataSourcesPanel() {
  return (
    <section className="rounded-2xl border border-white/[.07] bg-[#081411]/90 p-5 shadow-[0_18px_55px_rgba(0,0,0,.20)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-300/80">Data provenance</div>
          <h2 className="mt-1 text-lg font-semibold text-white">Verify the information</h2>
          <p className="mt-1 text-[10px] leading-4 text-zinc-600">PAL keeps source attribution visible. Open the provider to verify a release, headline, rate or market observation.</p>
        </div>
        <div className="rounded-lg border border-emerald-300/10 bg-emerald-300/[.03] px-3 py-2 text-[9px] font-semibold text-emerald-300">PROVIDER-LINKED</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SOURCES.map(([kind, name, url]) => (
          <a key={name} href={url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/[.05] bg-black/20 px-3 py-3 transition hover:border-cyan-300/20 hover:bg-cyan-300/[.025]">
            <div className="text-[8px] uppercase tracking-[.14em] text-zinc-700">{kind}</div>
            <div className="mt-1 text-[10px] font-semibold text-zinc-300">{name}</div>
            <div className="mt-2 text-[8px] text-cyan-300/65">Open source ↗</div>
          </a>
        ))}
      </div>
    </section>
  );
}
