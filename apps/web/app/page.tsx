import { ArrowRightLeft, Bot, BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import { SiteFooter } from "./components/layout/site-footer";
import { HeroSection } from "./components/marketing/hero-section";
import { TopNav } from "./components/layout/top-nav";
import { TradingViewWidget } from "./components/dashboard/tradingview-widget";

const pillars = [
  {
    icon: ArrowRightLeft,
    title: "Copy trading with guardrails",
    body: "Mirror verified traders using allocation caps, drawdown limits, and queue-backed execution against your own Deriv account.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: Bot,
    title: "No-code automation",
    body: "Build and deploy logic visually, using technical conditions, reusable templates, and always-on bot workers.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: BrainCircuit,
    title: "AI signal intelligence",
    body: "Score setups with probability widgets, momentum diagnostics, and volatility-aware alerts.",
    delayClass: "reveal-delay-3"
  },
  {
    icon: ShieldCheck,
    title: "Security first",
    body: "OAuth with PKCE, encrypted Deriv tokens, rate limits, and clear audit trails across linked accounts.",
    delayClass: "reveal-delay-4"
  }
];

const pricingPlans = [
  ["Free", "$0", "Demo linking, leaderboard access, one paper bot", "reveal-delay-1"],
  ["Pro", "$49", "Auto-copy execution, AI analytics, up to three live bots", "reveal-delay-2"],
  ["VIP", "$149", "Unlimited bots, premium masters, concierge onboarding", "reveal-delay-3"]
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <HeroSection />
      <section id="features" className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className={`panel-hover reveal-up ${pillar.delayClass} panel space-y-4 p-6`}>
                <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold text-white">{pillar.title}</h2>
                <p className="descriptive-copy text-sm text-slate-300">{pillar.body}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="reveal-up descriptive-copy mb-6 flex items-center gap-3 text-sm text-slate-400">
          <Sparkles className="h-4 w-4 text-accent" />
          Advanced charting with live-market context
        </div>
        <div className="reveal-up reveal-delay-1">
          <TradingViewWidget symbol="FX:EURUSD" />
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-10 pb-20">
        <div className="grid gap-4 lg:grid-cols-3">
          {pricingPlans.map(([name, price, body, delayClass]) => (
            <div key={name} className={`panel-hover reveal-up ${delayClass} panel space-y-4 p-6`}>
              <p className="font-secondary text-sm uppercase tracking-[0.28em] text-slate-400">{name}</p>
              <p className="price-copy text-4xl font-semibold text-white">{price}</p>
              <p className="descriptive-copy text-sm text-slate-300">{body}</p>
              <div className="descriptive-copy rounded-2xl border border-warning/20 bg-warning/10 p-4 text-xs text-warning">
                Regulatory notice: leveraged and synthetic products may not be suitable for all investors.
              </div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}