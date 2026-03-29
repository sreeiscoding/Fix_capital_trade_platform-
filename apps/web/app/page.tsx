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
  MoveRight,
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
    body: "Watching charts nonstop can drain your focus, increase emotional decisions, and make trading feel harder than it should.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: SearchX,
    title: "Struggling to find a strategy you can trust?",
    body: "Jumping between random signals, creators, and setups can leave you with more noise than clarity.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: ShieldAlert,
    title: "Taking risk without the right tools?",
    body: "Without proper controls, one bad decision can undo progress quickly and make it harder to stay consistent.",
    delayClass: "reveal-delay-3"
  }
] as const;

const howItWorksSteps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Create a free account",
    body: "Open your FixCapital account in minutes and start exploring the dashboard without needing a card.",
    delayClass: "reveal-delay-1"
  },
  {
    step: "02",
    icon: Link2,
    title: "Connect your Deriv account",
    body: "Link your Deriv demo or real account securely with OAuth while keeping your funds under your own broker login.",
    delayClass: "reveal-delay-2"
  },
  {
    step: "03",
    icon: ArrowRightLeft,
    title: "Choose copy trading or bots",
    body: "Follow a trader, launch a bot, or test both approaches in demo mode until you find what fits your style.",
    delayClass: "reveal-delay-3"
  },
  {
    step: "04",
    icon: SlidersHorizontal,
    title: "Set your risk preferences",
    body: "Choose allocation, drawdown limits, lot sizing, and other safety rules before any trade is allowed to execute.",
    delayClass: "reveal-delay-4"
  },
  {
    step: "05",
    icon: PlayCircle,
    title: "Watch trades execute automatically",
    body: "Track positions, alerts, and performance from one place while your workflow keeps running in the background.",
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
    label: "Designed for growing trader communities",
    body: "Built to support everyone from curious demo users to larger copy-trading audiences."
  },
  {
    icon: Clock3,
    value: "24/7",
    label: "Execution support around the clock",
    body: "Your workflow does not need to stop just because you cannot sit in front of charts all day."
  },
  {
    icon: ShieldCheck,
    value: "100%",
    label: "Your capital stays in Deriv",
    body: "You stay in control of your funds because FixCapital works as an overlay, not a custodian."
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
    title: "Spend less time glued to the screen",
    body: "Move from constant chart watching to a workflow supported by alerts, automation, and clearer execution rules.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: Workflow,
    title: "Keep everything in one place",
    body: "Bring copy trading, bots, live markets, and analytics together instead of managing scattered tools and tabs.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: BellRing,
    title: "Feel more in control of every trade",
    body: "Set your guardrails first, then monitor performance with more visibility and less guesswork.",
    delayClass: "reveal-delay-3"
  }
] as const;

const pillars = [
  {
    icon: ArrowRightLeft,
    title: "Copy trading with guardrails",
    body: "Follow verified traders while keeping control over allocation, drawdown limits, and account-level safety rules.",
    delayClass: "reveal-delay-1"
  },
  {
    icon: Bot,
    title: "No-code automation",
    body: "Build and run automated strategies without needing to code every part of the workflow yourself.",
    delayClass: "reveal-delay-2"
  },
  {
    icon: BrainCircuit,
    title: "AI signal intelligence",
    body: "Use market context, scoring, and alerts to make decisions with more confidence and less second-guessing.",
    delayClass: "reveal-delay-3"
  },
  {
    icon: ShieldCheck,
    title: "Security first",
    body: "Protect your account with OAuth, encrypted tokens, rate limits, and transparent audit trails.",
    delayClass: "reveal-delay-4"
  }
] as const;

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
    summary: "Start exploring the platform, test the experience, and learn how the workflow fits you.",
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
    summary: "Unlock live copy execution, deeper analytics, and more automation when you are ready to level up.",
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
    summary: "Choose VIP when you want more scale, premium access, and guided support around your trading workflow.",
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
    answer: "No. Your trading capital stays inside your own Deriv account, and account linking happens through secure OAuth."
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
    answer: "Yes, especially in demo mode. The onboarding flow is designed to feel simple while giving you risk warnings, controls, and a safer path into live trading."
  }
] as const;

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  body: string;
  className?: string;
};

function SectionFlow() {
  return (
    <div className="section-flow reveal-fade" aria-hidden="true">
      <span className="section-flow__orb" />
      <span className="section-flow__line" />
    </div>
  );
}

function SectionIntro({ eyebrow, title, body, className = "max-w-3xl" }: SectionIntroProps) {
  return (
    <div className={`section-intro ${className}`}>
      <p className="section-eyebrow reveal-up">{eyebrow}</p>
      <h2 className="section-title reveal-up reveal-delay-1">{title}</h2>
      <p className="section-copy reveal-up reveal-delay-2">{body}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <HeroSection />

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <SectionIntro
          eyebrow="The problem"
          title="If trading still depends on constant screen time, it can start to feel exhausting fast."
          body="You should not have to bounce between charts, signals, and scattered tools just to trade with more confidence and control."
          className="max-w-2xl"
        />
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

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro
            eyebrow="How it works"
            title="Getting started should feel simple, even if you are new to copy trading or bots."
            body="Create your account, connect Deriv, choose your workflow, and stay in control from the very first step."
            className="max-w-2xl"
          />
          <Link
            href="/auth/login"
            className="descriptive-copy inline-flex self-center items-center justify-center rounded-2xl bg-accent px-5 py-2 text-sm font-medium text-slate-950 transition duration-200 hover:brightness-110 sm:self-auto sm:w-auto"
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

      <section id="features" className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <SectionIntro
          eyebrow="What you can do"
          title="Everything you need to trade with more structure, more visibility, and less noise."
          body="Each part of the platform is built to help you act with more clarity, whether you are copying traders, running bots, or managing risk."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className={`panel-hover reveal-up ${pillar.delayClass} panel space-y-4 p-6`}>
                <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-white">{pillar.title}</h3>
                <p className="descriptive-copy text-sm text-slate-300">{pillar.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <SectionIntro
          eyebrow="Social proof and trust"
          title="You want proof before you trust a trading workflow, and that is exactly how it should be."
          body="FixCapital helps you evaluate the platform with visible safety signals, trader outcomes, and a clearer picture of how the experience is built to support you."
        />
        <div className="mb-4 flex flex-wrap justify-center gap-3 md:justify-start">
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
                <h3 className="mt-1 text-2xl font-semibold text-white">What traders say they value most</h3>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <div key={testimonial.name} className={`panel-hover reveal-up reveal-delay-${Math.min(index + 1, 5)} panel-muted h-full space-y-4 p-5`}>
                  <p className="text-2xl leading-none text-accent">"</p>
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
                <h3 className="mt-1 text-2xl font-semibold text-white">A quick look at top masters</h3>
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
              Preview only. Live leaderboard statistics can be connected as production trading data becomes available.
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <SectionIntro
          eyebrow="Why choose FixCapital"
          title="Choose a workflow that helps you feel calmer, clearer, and more in control."
          body="When you want trading to feel more organized and less reactive, FixCapital helps you bring risk rules, visibility, and execution into one place."
        />
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
              <h3 className="mt-2 text-2xl font-semibold text-white">What changes when your workflow is built around control</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5">
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-destructive">Before</p>
                <p className="mt-3 text-lg font-semibold text-white">Scattered decisions and inconsistent execution</p>
                <p className="descriptive-copy mt-2 text-sm text-slate-300">Too many tabs, unclear signals, and limited risk structure can make trading feel reactive and stressful.</p>
              </div>
              <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-success">After</p>
                <p className="mt-3 text-lg font-semibold text-white">A more structured way to trade</p>
                <p className="descriptive-copy mt-2 text-sm text-slate-300">One dashboard, clear guardrails, and automation support can help you move with more clarity and less friction.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 md:py-10">
        <SectionFlow />
        <SectionIntro
          eyebrow="See the market"
          title="Watch the market in context before you make your next move."
          body="Use live charting to stay grounded in current price action while the rest of your workflow stays organized in the same experience."
        />
        <div className="reveal-up reveal-delay-1">
          <TradingViewWidget symbol="FX:EURUSD" />
        </div>
      </section>

      <section id="pricing" className="section-shell mx-auto max-w-7xl px-4 py-8 pb-16 md:py-10 md:pb-20">
        <SectionFlow />
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro
            eyebrow="Pricing"
            title="Start free today and upgrade only when you are ready for more automation, control, and support."
            body="Choose the plan that fits where you are now, with room to grow into live copy trading, automation, and more advanced workflows later."
            className="max-w-3xl"
          />
          <div className="descriptive-copy inline-flex w-full items-center justify-center rounded-full border border-success/20 bg-success/10 px-4 py-2 text-sm text-success sm:w-auto lg:justify-start">
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
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-secondary text-sm uppercase tracking-[0.28em] text-slate-400">{plan.name}</p>
                  <p className="price-copy mt-3 text-4xl font-semibold text-white">
                    {plan.monthlyPrice}
                    <span className="text-lg text-slate-400">/mo</span>
                  </p>
                  <p className="descriptive-copy mt-2 text-sm text-slate-300">{plan.summary}</p>
                </div>
                <span className={`descriptive-copy self-start whitespace-nowrap rounded-full px-3 py-1 text-xs ${plan.featured ? "bg-accent text-slate-950" : "border border-border/70 bg-card/70 text-slate-200"}`}>
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
                className={`descriptive-copy inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition duration-200 sm:w-auto ${plan.ctaStyle}`}
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

      <section className="section-shell mx-auto max-w-7xl px-4 py-8 pb-16 md:py-10 md:pb-20">
        <SectionFlow />
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="panel reveal-up space-y-5 p-5 sm:p-6 lg:sticky lg:top-24">
            <div>
              <p className="section-eyebrow">FAQ</p>
              <h2 className="section-title">Answers to help you feel confident before you start.</h2>
              <p className="section-copy">
                Get clear answers to the questions that matter most when you are deciding whether to start in demo mode, link your account, or move into live trading.
              </p>
            </div>
            <div className="rounded-3xl border border-accent/20 bg-accent/10 p-5">
              <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-accent">Getting started</p>
              <p className="mt-3 text-lg font-semibold text-white">Start free, test in demo, then scale into live workflows when you are ready.</p>
              <p className="descriptive-copy mt-3 text-sm text-slate-300">
                You can get the practical answers you need early, so it feels easier to move forward with more clarity and less hesitation.
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
      </section>

      <section className="section-shell mx-auto max-w-7xl px-4 pb-16 md:pb-20">
        <SectionFlow />
        <div className="panel reveal-up overflow-hidden border-accent/30 bg-gradient-to-br from-accent/12 via-card/95 to-card p-8 md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="section-eyebrow">Get started</p>
              <h2 className="section-title">Start free, explore the workflow in demo mode, and move to live trading only when you feel ready.</h2>
              <p className="section-copy">
                FixCapital gives you one place to discover traders, configure bots, manage risk, and monitor execution without handing over custody of your capital.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:items-center lg:items-end">
              <Link
                href="/auth/login"
                className="descriptive-copy inline-flex w-full items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-slate-950 transition duration-200 hover:brightness-110 sm:w-auto"
              >
                Start Free - No card required
                <MoveRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="descriptive-copy inline-flex w-full items-center justify-center rounded-2xl border border-border bg-transparent px-5 py-3 text-sm font-medium text-foreground transition duration-200 hover:bg-white/5 sm:w-auto"
              >
                Try in Demo Mode
              </Link>
              <p className="descriptive-copy text-xs text-slate-400">Demo-first onboarding. Secure Deriv OAuth. Risk controls built in.</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
