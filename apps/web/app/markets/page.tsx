import { SiteFooter } from "@/components/layout/site-footer";
import { TopNav } from "@/components/layout/top-nav";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";

export default function MarketsPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">
        <section className="panel space-y-4 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Live market hub</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Forex, metals, and synthetic markets in one view</h1>
          <p className="max-w-3xl text-sm text-slate-300">Use this page to inspect context before enabling copy relationships or automated rules. Always test new logic on demo first.</p>
        </section>
        <TradingViewWidget symbol="OANDA:XAUUSD" />
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["EUR/USD", "Trend bias", "Bullish above 1.08 with moderate volatility"],
            ["Gold", "Risk regime", "Elevated macro sensitivity into US session"],
            ["R_100", "Synthetic context", "Fast mean-reversion bursts; size cautiously"]
          ].map(([title, label, body]) => (
            <div key={title} className="panel space-y-3 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
              <h2 className="text-2xl font-semibold text-white">{title}</h2>
              <p className="text-sm text-slate-300">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}