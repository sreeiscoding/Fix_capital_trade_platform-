import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRightLeft,
  BadgeCheck,
  BellRing,
  Bot,
  BrainCircuit,
  ChartCandlestick,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  Link2,
  PlayCircle,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Workflow
} from "lucide-react";
import { SiteFooter } from "./components/layout/site-footer";
import { HeroSection } from "./components/marketing/hero-section";
import { TopNav } from "./components/layout/top-nav";
import { TradingViewWidget } from "./components/dashboard/tradingview-widget";

const frustrations = [
  {
    icon: ChartCandlestick,
    title: "Tired of staring at charts all day?",
    body: "Manual chart watching drains focus, increases impulse trades, and makes it hard to react consistently across sessions.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: SearchX,
    title: "Struggling to find consistent strategies?",
    body: "Jumping between signals, creators, and random setups often leads to noise instead of a repeatable trading process.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: ShieldAlert,
    title: "High risk without proper tools?",
    body: "Without allocation controls, drawdown protection, and execution safeguards, a single bad idea can spiral quickly.",
    delayClass: "reveal-delay-3"
  }
];

const howItWorksSteps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Create a free account",
    body: "Start with a FixCapital profile so you can access the dashboard, demo workspace, and onboarding tools.",
    delayClass: "reveal-delay-1"
  },
  {
    step: "02",
    icon: Link2,
    title: "Connect your Deriv account",
    body: "Link your Deriv demo or real account securely with OAuth. Your funds always remain in your own broker account.",
    delayClass: "reveal-delay-2"
  },
  {
    step: "03",
    icon: ArrowRightLeft,
    title: "Choose copy trading or bots",
    body: "Pick a verified trader to follow, launch an automated strategy, or test both approaches in demo mode first.",
    delayClass: "reveal-delay-3"
  },
  {
    step: "04",
    icon: SlidersHorizontal,
    title: "Set your risk preferences",
    body: "Control allocation, drawdown limits, lot sizing, and other safety rules before any trades are mirrored or automated.",
    delayClass: "reveal-delay-4"
  },
  {
    step: "05",
    icon: PlayCircle,
    title: "Watch trades execute automatically",
    body: "Monitor live activity, performance, and alerts from one place while FixCapital handles the execution workflow.",
    delayClass: "reveal-delay-5"
  }
] as const;

const trustBadges = [
  { icon: ShieldCheck, label: "Secure Deriv Integration" },
  { icon: Clock3, label: "24/7 Execution" },
  { icon: SlidersHorizontal, label: "Risk Controls Built-In" },
  { icon: BadgeCheck, label: "Demo-First Onboarding" }
] as const;

const successMetrics = [
  {
    icon: Users,
    value: "10,000+",
    label: "Built to support growing trader communities",
    body: "Designed for onboarding from first-time demo users through larger copy-trading audiences."
  },
  {
    icon: Clock3,
    value: "24/7",
    label: "Execution coverage",
    body: "Bot and copy workflows are structured for always-on monitoring instead of manual chart watching."
  },
  {
    icon: ShieldCheck,
    value: "100%",
    label: "User capital stays in Deriv",
    body: "FixCapital never takes custody of client funds and operates as an overlay on linked broker accounts."
  }
] as const;

const testimonials = [
  {
    quote: "The demo mode made it easy to test a master trader before risking anything. That gave me much more confidence in the process.",
    name: "Arjun P.",
    role: "Retail trader"
  },
  {
    quote: "I like that I can set drawdown limits before copying. It feels much more controlled than manually following signals in chat groups.",
    name: "Leila S.",
    role: "Copy trading user"
  },
  {
    quote: "The dashboard saves me time. I can monitor bots, markets, and performance in one place instead of bouncing between tabs.",
    name: "Marcus T.",
    role: "Automation user"
  }
] as const;

const leaderboardPreview = [
  { name: "Atlas Momentum", winRate: "68.4%", profitFactor: "1.92" },
  { name: "FX Pulse 7", winRate: "64.1%", profitFactor: "1.74" },
  { name: "Synthetic Edge", winRate: "61.8%", profitFactor: "1.66" }
] as const;

const transformationBenefits = [
  {
    icon: Gauge,
    title: "Less screen fatigue, more structured decisions",
    body: "Move from constant chart-checking to a workflow built around alerts, automation, and clearer execution rules.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: Workflow,
    title: "One platform instead of scattered tools",
    body: "Copy trading, bots, live markets, and analytics live in one connected dashboard instead of separate tabs and chat groups.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: BellRing,
    title: "Confidence through visibility and control",
    body: "Set risk limits before execution and stay informed with live updates, signals, and performance monitoring.",
    delayClass: "reveal-delay-3"
  }
] as const;

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

type PricingPlan = {
  name: string;
  monthlyPrice: string;
  annualNote: string;
  annualDiscount?: string;
  summary: string;
  cta: string;
  ctaHref: Route;
  ctaStyle: string;
  badge: string;
  featured?: boolean;
  delayClass: string;
  features: readonly string[];
};

const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualNote: "Always free",
    summary: "Best for first-time users exploring the dashboard and demo workflows.",
    cta: "Start Free",
    ctaHref: "/auth/login",
    ctaStyle: "border border-border bg-transparent text-foreground hover:bg-white/5",
    badge: "No card required",
    delayClass: "reveal-delay-1",
    features: [
      "Create your FixCapital account and access the dashboard",
      "Connect a Deriv demo account",
      "Explore leaderboards and market analytics",
      "Run one paper bot in demo mode"
    ]
  },
  {
    name: "Pro",
    monthlyPrice: "$49",
    annualNote: "$39/mo billed annually",
    annualDiscount: "Save 20% on annual billing",
    summary: "For active traders ready to unlock live copy execution and AI-assisted workflows.",
    cta: "Upgrade to Pro",
    ctaHref: "/auth/login",
    ctaStyle: "bg-accent text-slate-950 hover:brightness-110",
    badge: "Most popular",
    featured: true,
    delayClass: "reveal-delay-2",
    features: [
      "Everything in Free",
      "Live copy trading execution with risk controls",
      "AI analytics and signal widgets",
      "Up to 3 live automated bots"
    ]
  },
  {
    name: "VIP",
    monthlyPrice: "$149",
    annualNote: "$119/mo billed annually",
    annualDiscount: "Save 20% on annual billing",
    summary: "For serious operators who want scale, premium access, and guided onboarding.",
    cta: "Talk to Sales",
    ctaHref: "/auth/login",
    ctaStyle: "border border-accent/30 bg-accent/10 text-accent hover:bg-accent/15",
    badge: "Premium",
    delayClass: "reveal-delay-3",
    features: [
      "Everything in Pro",
      "Unlimited bots and premium masters",
      "Priority support and concierge onboarding",
      "Advanced account and workflow support"
    ]
  }
] as const;

const faqs = [
  {
    question: "Do I need to deposit money into FixCapital?",
    answer: "No. FixCapital is an overlay platform. Your trading capital stays inside your own Deriv account, and account linking happens through secure OAuth."
  },
  {
    question: "Can I try the platform without risking real money?",
    answer: "Yes. You can start with a free account, link a Deriv demo account, and test copy trading or bots in demo mode before moving to a live setup."
  },
  {
    question: "What is included in the free plan?",
    answer: "The free plan gives you dashboard access, demo linking, leaderboard visibility, market analytics, and one paper bot so you can explore the workflow without a card."
  },
  {
    question: "How does copy trading risk control work?",
    answer: "You choose your own allocation, drawdown limits, lot sizing, and other guardrails before mirrored trades are allowed to execute on your linked account."
  },
  {
    question: "Is FixCapital suitable for beginners?",
    answer: "Yes, especially in demo mode. The onboarding flow is designed to be simple, and the platform emphasizes risk warnings, controls, and gradual progression to live trading."
  }
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <HeroSection />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 max-w-2xl">
          <p className="descriptive-copy reveal-up text-xs uppercase tracking-[0.28em] text-warning">The problem</p>
          <h2 className="reveal-up reveal-delay-1 mt-3 text-3xl font-semibold text-white md:text-4xl">Trading feels harder when the process depends on constant screen time.</h2>
          <p className="descriptive-copy reveal-up reveal-delay-2 mt-4 text-sm text-slate-300 md:text-base">
            FixCapital is built for retail traders who want structure, execution support, and better risk control instead of guesswork.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {frustrations.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`panel-hover reveal-up ${item.delayClass} panel space-y-4 border-warning/20 bg-warning/5 p-6`}>
                <div className="inline-flex rounded-2xl bg-warning/10 p-3 text-warning">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="descriptive-copy text-sm text-slate-300">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="descriptive-copy reveal-up text-xs uppercase tracking-[0.28em] text-accent">How it works</p>
            <h2 className="reveal-up reveal-delay-1 mt-3 text-3xl font-semibold text-white md:text-4xl">A simple five-step flow for getting started safely.</h2>
            <p className="descriptive-copy reveal-up reveal-delay-2 mt-4 text-sm text-slate-300 md:text-base">
              From account setup to automated execution, each step is designed to be clear for new users and flexible for active traders.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="descriptive-copy inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-slate-950 transition duration-200 hover:brightness-110"
          >
            Try in Demo Mode
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {howItWorksSteps.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.step} className={`panel-hover reveal-up ${item.delayClass} panel flex h-full flex-col gap-4 p-6`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="descriptive-copy inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm text-accent">
                    {item.step}
                  </span>
                  <span className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="descriptive-copy text-sm text-slate-300">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>
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
        <div className="mb-6 max-w-3xl">
          <p className="descriptive-copy reveal-up text-xs uppercase tracking-[0.28em] text-accent">Social proof and trust</p>
          <h2 className="reveal-up reveal-delay-1 mt-3 text-3xl font-semibold text-white md:text-4xl">Built to feel credible before a user places the first trade.</h2>
          <p className="descriptive-copy reveal-up reveal-delay-2 mt-4 text-sm text-slate-300 md:text-base">
            See how FixCapital builds confidence with visible safety signals, credible trader outcomes, and proof that the platform is designed for disciplined execution.
          </p>
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          {trustBadges.map((badge, index) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2`}>
                <Icon className="h-4 w-4 text-accent" />
                <span className="descriptive-copy text-sm text-slate-200">{badge.label}</span>
              </div>
            );
          })}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {successMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} panel space-y-4 p-6`}>
                <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="price-copy text-4xl font-semibold text-white">{metric.value}</p>
                <h3 className="text-lg font-semibold text-white">{metric.label}</h3>
                <p className="descriptive-copy text-sm text-slate-300">{metric.body}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="panel space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-accent" />
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">User testimonials</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">What traders want from the experience</h3>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <div key={testimonial.name} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} panel-muted h-full space-y-4 p-5`}>
                  <p className="text-accent">""</p>
                  <p className="descriptive-copy text-sm text-slate-200">{testimonial.quote}</p>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="descriptive-copy text-xs text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-accent" />
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Leaderboard teaser</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">Top masters preview</h3>
              </div>
            </div>
            <div className="space-y-3">
              {leaderboardPreview.map((master, index) => (
                <div key={master.name} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} panel-muted flex items-center justify-between gap-4 p-4`}>
                  <div>
                    <p className="font-semibold text-white">{master.name}</p>
                    <p className="descriptive-copy text-xs text-slate-400">Win rate {master.winRate}</p>
                  </div>
                  <div className="text-right">
                    <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Profit factor</p>
                    <p className="price-copy text-base font-semibold text-accent">{master.profitFactor}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="descriptive-copy rounded-2xl border border-warning/20 bg-warning/10 p-4 text-xs text-warning">
              Leaderboard shown as a teaser preview. Replace with live master statistics once production trading data is connected.
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 max-w-3xl">
          <p className="descriptive-copy reveal-up text-xs uppercase tracking-[0.28em] text-accent">Why choose FixCapital</p>
          <h2 className="reveal-up reveal-delay-1 mt-3 text-3xl font-semibold text-white md:text-4xl">Move from reactive trading habits to a calmer, more controlled workflow.</h2>
          <p className="descriptive-copy reveal-up reveal-delay-2 mt-4 text-sm text-slate-300 md:text-base">
            The benefit is not just more features. It is the transformation from fragmented execution to a system built around discipline, visibility, and repeatable decisions.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4 md:grid-cols-3">
            {transformationBenefits.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`panel-hover reveal-up ${item.delayClass} panel h-full space-y-4 p-6`}>
                  <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="descriptive-copy text-sm text-slate-300">{item.body}</p>
                </div>
              );
            })}
          </div>
          <div className="panel reveal-up reveal-delay-4 space-y-5 p-6">
            <div>
              <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Transformation snapshot</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Before and after the workflow shift</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5">
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-destructive">Before</p>
                <p className="mt-3 text-lg font-semibold text-white">Scattered decisions and inconsistent execution</p>
                <p className="descriptive-copy mt-2 text-sm text-slate-300">Too many tabs, unclear signals, and limited risk structure make trading feel reactive.</p>
              </div>
              <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-success">After</p>
                <p className="mt-3 text-lg font-semibold text-white">Structured workflows with guardrails</p>
                <p className="descriptive-copy mt-2 text-sm text-slate-300">One dashboard, defined risk rules, and automated execution help users trade with more clarity and less friction.</p>
              </div>
            </div>
          </div>
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
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="descriptive-copy reveal-up text-xs uppercase tracking-[0.28em] text-accent">Pricing</p>
            <h2 className="reveal-up reveal-delay-1 mt-3 text-3xl font-semibold text-white md:text-4xl">Choose the plan that fits where you are now and grow when you are ready for more automation, control, and support.</h2>
            <p className="descriptive-copy reveal-up reveal-delay-2 mt-4 text-sm text-slate-300 md:text-base">
              Start Free with no card required, then unlock live copy execution, bots, and premium support as your workflow grows.
            </p>
          </div>
          <div className="descriptive-copy inline-flex items-center rounded-full border border-success/20 bg-success/10 px-4 py-2 text-sm text-success">
            Annual billing available: save 20%
          </div>
        </div>
        <div className="mb-4 rounded-3xl border border-accent/20 bg-accent/10 p-4">
          <p className="descriptive-copy text-sm text-accent">Start Free, no card required. Upgrade only when you are ready to unlock live execution and advanced automation.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`panel-hover reveal-up ${plan.delayClass} panel flex h-full flex-col space-y-5 p-6 ${plan.featured ? "border-accent/40 shadow-[0_0_0_1px_rgba(87,212,168,0.18),0_20px_60px_rgba(5,10,17,0.45)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-secondary text-sm uppercase tracking-[0.28em] text-slate-400">{plan.name}</p>
                  <p className="price-copy mt-3 text-4xl font-semibold text-white">{plan.monthlyPrice}<span className="text-lg text-slate-400">/mo</span></p>
                  <p className="descriptive-copy mt-2 text-sm text-slate-300">{plan.summary}</p>
                </div>
                <span className={`descriptive-copy whitespace-nowrap rounded-full px-3 py-1 text-xs ${plan.featured ? "bg-accent text-slate-950" : "border border-border/70 bg-card/70 text-slate-200"}`}>
                  {plan.badge}
                </span>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="descriptive-copy text-xs uppercase tracking-[0.2em] text-slate-500">Unlocked in this tier</p>
                <ul className="mt-3 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="descriptive-copy flex items-start gap-2 text-sm text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-accent" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="descriptive-copy text-sm text-slate-300">{plan.annualNote}</p>
                {plan.annualDiscount ? <p className="descriptive-copy text-xs text-success">{plan.annualDiscount}</p> : null}
              </div>
              <Link
                href={plan.ctaHref}
                className={`descriptive-copy inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition duration-200 ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
              <div className="descriptive-copy rounded-2xl border border-warning/20 bg-warning/10 p-4 text-xs text-warning">
                Regulatory notice: leveraged and synthetic products may not be suitable for all investors.
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 pb-20">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="panel reveal-up space-y-5 p-6 lg:sticky lg:top-24">
            <div>
              <p className="descriptive-copy text-xs uppercase tracking-[0.28em] text-accent">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Common questions before you get started.</h2>
              <p className="descriptive-copy mt-4 text-sm text-slate-300 md:text-base">
                Quick answers to the things most users want to know before linking an account, testing in demo mode, or moving to live execution.
              </p>
            </div>
            <div className="rounded-3xl border border-accent/20 bg-accent/10 p-5">
              <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-accent">Getting started</p>
              <p className="mt-3 text-lg font-semibold text-white">Start free, test in demo, then scale into live workflows when you are ready.</p>
              <p className="descriptive-copy mt-3 text-sm text-slate-300">
                The platform is designed to answer practical setup questions early so users can move forward with more clarity and less hesitation.
              </p>
            </div>
          </div>
          <div className="grid gap-4">
            {faqs.map((item, index) => (
              <details key={item.question} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} panel group overflow-hidden p-0`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="pr-4 text-base font-semibold text-white md:text-lg">{item.question}</span>
                  <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
                    <ChevronDown className="h-5 w-5 transition duration-200 group-open:rotate-180" />
                  </span>
                </summary>
                <div className="border-t border-border/70 px-6 py-5">
                  <p className="descriptive-copy max-w-2xl text-sm leading-6 text-slate-300">{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section><SiteFooter />
    </div>
  );
}
