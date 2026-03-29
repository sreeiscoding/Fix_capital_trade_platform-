"use client";

import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Minus,
  MoveRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { fallbackMarketQuotes, type MarketQuote } from "@/lib/market-quotes";

const features: Array<{ icon: LucideIcon; label: string; delayClass: string }> = [
  { icon: ArrowRightLeft, label: "Verified master trader leaderboards", delayClass: "reveal-delay-2" },
  { icon: Bot, label: "No-code bot orchestration with risk rails", delayClass: "reveal-delay-3" },
  { icon: ShieldCheck, label: "Deriv OAuth linking with demo-first flows", delayClass: "reveal-delay-4" },
  { icon: BrainCircuit, label: "AI-assisted signals, monitoring, and alerts", delayClass: "reveal-delay-5" }
];

type QuoteFeedStatus = "loading" | "live" | "fallback";
type PriceDirection = "up" | "down" | "flat";
type QuoteDirectionMap = Record<string, { ask: PriceDirection; bid: PriceDirection }>;

type MarketQuoteResponse = {
  source: "live" | "fallback";
  quotes: MarketQuote[];
};

function getPriceDirection(previousValue: string | undefined, nextValue: string): PriceDirection {
  const previous = Number.parseFloat(previousValue ?? "");
  const next = Number.parseFloat(nextValue);

  if (!Number.isFinite(previous) || !Number.isFinite(next)) {
    return "flat";
  }

  if (next > previous) {
    return "up";
  }

  if (next < previous) {
    return "down";
  }

  return "flat";
}

function getDirectionPresentation(direction: PriceDirection) {
  if (direction === "up") {
    return {
      icon: ArrowUpRight,
      className: "text-success"
    };
  }

  if (direction === "down") {
    return {
      icon: ArrowDownRight,
      className: "text-destructive"
    };
  }

  return {
    icon: Minus,
    className: "text-slate-500"
  };
}

export function HeroSection() {
  const router = useRouter();
  const { user } = useAuth();
  const previousQuotesRef = useRef<Record<string, MarketQuote>>({});
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>(fallbackMarketQuotes);
  const [quoteDirections, setQuoteDirections] = useState<QuoteDirectionMap>({});
  const [quoteFeedStatus, setQuoteFeedStatus] = useState<QuoteFeedStatus>("loading");

  const lastUpdatedLabel = useMemo(() => {
    const latest = marketQuotes.reduce<string>((current, quote) => {
      if (!current) {
        return quote.updatedAt;
      }

      return new Date(quote.updatedAt).getTime() > new Date(current).getTime() ? quote.updatedAt : current;
    }, "");

    if (!latest || latest === new Date(0).toISOString()) {
      return quoteFeedStatus === "loading" ? "Connecting to market feed" : "Waiting for first update";
    }

    const formattedTime = new Date(latest).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    if (quoteFeedStatus === "live") {
      return `Live ${formattedTime}`;
    }

    if (quoteFeedStatus === "fallback") {
      return `Indicative ${formattedTime}`;
    }

    return `Refreshing ${formattedTime}`;
  }, [marketQuotes, quoteFeedStatus]);

  useEffect(() => {
    let active = true;

    const loadQuotes = async () => {
      try {
        const response = await apiRequest<MarketQuoteResponse>("/api/v1/deriv/market-quotes");
        if (!active || response.quotes.length === 0) {
          return;
        }

        const nextDirections = response.quotes.reduce<QuoteDirectionMap>((accumulator, quote) => {
          const previousQuote = previousQuotesRef.current[quote.symbol];
          accumulator[quote.symbol] = {
            ask: getPriceDirection(previousQuote?.ask, quote.ask),
            bid: getPriceDirection(previousQuote?.bid, quote.bid)
          };
          return accumulator;
        }, {});

        previousQuotesRef.current = Object.fromEntries(response.quotes.map((quote) => [quote.symbol, quote]));
        setQuoteDirections(nextDirections);
        setMarketQuotes(response.quotes);
        setQuoteFeedStatus(response.source);
      } catch (error) {
        if (!active) {
          return;
        }

        setQuoteFeedStatus("fallback");
      }
    };

    void loadQuotes();
    const interval = window.setInterval(() => {
      void loadQuotes();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleLaunchWorkspace = () => {
    const nextRoute: Route = user ? "/dashboard" : "/auth/login";
    router.push(nextRoute);
  };

  const handleViewPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
      <div>
        <Badge className="reveal-up border-accent/30 bg-accent/10 text-accent">
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Deriv execution, FixCapital intelligence
        </Badge>
        <h1 className="reveal-up reveal-delay-1 mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
          Copy proven traders, deploy bots, and manage risk from one trading cockpit.
        </h1>
        <p className="descriptive-copy reveal-up reveal-delay-2 mt-6 max-w-2xl text-lg text-slate-300">
          FixCapital is a neutral SaaS overlay for Deriv accounts. Your funds stay in your own broker account while we handle discovery, automation, analytics, and operator-grade execution workflows.
        </p>
        <div className="reveal-up reveal-delay-3 mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={handleLaunchWorkspace}>
            Launch demo workspace
            <MoveRight className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={handleViewPricing}>
            View pricing
            <TrendingUp className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="descriptive-copy mt-10 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.label} className={`panel-hover reveal-up ${feature.delayClass} panel-muted flex items-center gap-3 px-4 py-3`}>
                <span className="rounded-2xl bg-accent/10 p-2 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{feature.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="reveal-up reveal-delay-2 float-slow panel relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-grid bg-[length:28px_28px] opacity-20" />
        <div className="relative space-y-4">
          <div className="panel-hover flex items-center justify-between rounded-2xl border border-border/70 bg-slate-950/40 p-4">
            <div>
              <p className="descriptive-copy flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Monthly copied volume
              </p>
              <p className="price-copy mt-2 text-3xl font-semibold text-white">$3.84M</p>
            </div>
            <span className="pulse-soft rounded-full bg-success/15 px-3 py-1 font-secondary text-xs text-success">+18.2%</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel-hover panel-muted p-4">
              <p className="descriptive-copy flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Top master win rate
              </p>
              <p className="price-copy mt-3 text-2xl font-semibold text-white">68.4%</p>
            </div>
            <div className="panel-hover panel-muted p-4">
              <p className="descriptive-copy flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI signal confidence
              </p>
              <p className="price-copy mt-3 text-2xl font-semibold text-white">0.74</p>
            </div>
          </div>
          <div className="descriptive-copy flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
            <span>CFDs, multipliers, and synthetic markets involve substantial risk. Past performance is not indicative of future results.</span>
          </div>
          <div className="panel-hover reveal-up reveal-delay-3 rounded-3xl border border-border/70 bg-slate-950/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Market snapshot</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Ask and bid prices</h3>
              </div>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-secondary text-xs text-accent">
                {lastUpdatedLabel}
              </span>
            </div>
            {quoteFeedStatus === "fallback" ? (
              <div className="mb-4 rounded-2xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                Live Deriv ticks are temporarily unavailable, so this board is showing an updating indicative snapshot until the feed resumes.
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {marketQuotes.map((quote, index) => {
                const askDirection = quoteDirections[quote.symbol]?.ask ?? "flat";
                const bidDirection = quoteDirections[quote.symbol]?.bid ?? "flat";
                const askPresentation = getDirectionPresentation(askDirection);
                const bidPresentation = getDirectionPresentation(bidDirection);
                const AskIcon = askPresentation.icon;
                const BidIcon = bidPresentation.icon;

                return (
                  <div
                    key={quote.symbol}
                    className={`panel-muted reveal-up reveal-delay-${Math.min(index + 1, 5)} space-y-3 p-4`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{quote.label}</p>
                      <span className={`rounded-full px-2 py-1 font-secondary text-[11px] ${
                        quoteFeedStatus === "live"
                          ? "bg-success/10 text-success"
                          : quoteFeedStatus === "loading"
                            ? "bg-accent/10 text-accent"
                            : "bg-warning/10 text-warning"
                      }`}>
                        {quoteFeedStatus === "live" ? "Live" : quoteFeedStatus === "loading" ? "Loading" : "Fallback"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Ask</p>
                        <div className={`price-copy mt-1 flex items-center gap-2 text-base font-semibold ${askPresentation.className}`}>
                          <AskIcon className="h-4 w-4" />
                          <span>{quote.ask}</span>
                        </div>
                      </div>
                      <div>
                        <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Bid</p>
                        <div className={`price-copy mt-1 flex items-center gap-2 text-base font-semibold ${bidPresentation.className}`}>
                          <BidIcon className="h-4 w-4" />
                          <span>{quote.bid}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
