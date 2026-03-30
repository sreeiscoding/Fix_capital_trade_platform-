"use client";

import { Activity, ArrowDownRight, ArrowUpRight, Clock3, Globe2, Minus, Radar, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DerivMarketChart } from "@/components/dashboard/deriv-market-chart";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopNav } from "@/components/layout/top-nav";
import { apiRequest } from "@/lib/api";
import { fallbackMarketQuotes, type MarketQuote } from "@/lib/market-quotes";

type MarketQuoteResponse = {
  source: "live" | "mixed" | "fallback";
  quotes: MarketQuote[];
};

type MarketDetail = {
  chartProvider: "tradingview" | "deriv";
  tvSymbol?: string;
  category: string;
  headline: string;
  context: string;
  checklist: string[];
};

type QuoteFeedStatus = "loading" | "live" | "mixed" | "fallback";
type PriceDirection = "up" | "down" | "flat";
type QuoteDirectionMap = Record<string, { ask: PriceDirection; bid: PriceDirection; mid: PriceDirection }>;

type DerivTickMessage = {
  msg_type?: string;
  tick?: {
    symbol?: string;
    quote?: number;
    pip_size?: number;
    epoch?: number;
  };
  error?: {
    message?: string;
  };
};

const DERIV_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL ?? "wss://ws.derivws.com/websockets/v3";
const DERIV_PUBLIC_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089";

const marketDetails: Record<string, MarketDetail> = {
  frxEURUSD: {
    chartProvider: "tradingview",
    tvSymbol: "FX:EURUSD",
    category: "Forex major",
    headline: "Use EUR/USD when you want a liquid, macro-driven benchmark for trade ideas.",
    context: "This pair is useful for testing copy-trading behavior, validating bot timing, and reading broad risk sentiment before enabling live workflows.",
    checklist: [
      "Check the quote spread before copying a fast trader",
      "Review session timing before enabling automation",
      "Start with demo sizing when market volatility is rising"
    ]
  },
  frxXAUUSD: {
    chartProvider: "tradingview",
    tvSymbol: "OANDA:XAUUSD",
    category: "Metal",
    headline: "Use gold when you need a market that reacts quickly to macro fear, inflation, and rates.",
    context: "Gold can move sharply around news and US session momentum, so it is a useful market for testing risk controls and disciplined execution rules.",
    checklist: [
      "Use tighter risk controls when macro headlines are active",
      "Avoid over-sizing during fast directional spikes",
      "Test automation logic in demo before going live"
    ]
  },
  frxGBPJPY: {
    chartProvider: "tradingview",
    tvSymbol: "FX:GBPJPY",
    category: "High beta forex",
    headline: "Use GBP/JPY when you want a faster market that rewards clear rules and disciplined sizing.",
    context: "This pair often moves with stronger momentum than majors, making it useful for breakout logic, but it needs tighter guardrails around exposure.",
    checklist: [
      "Lower allocation when volatility expands quickly",
      "Use drawdown limits before enabling copying",
      "Avoid running untested aggressive bot logic live"
    ]
  },
  R_100: {
    chartProvider: "deriv",
    category: "Synthetic index",
    headline: "Use synthetic indices when you want uninterrupted Deriv-native market conditions for testing speed, discipline, and automation logic.",
    context: "Synthetic markets are broker-native instruments, so the clearest chart source is Deriv itself. Use them to validate reaction speed, risk limits, and execution rules before scaling anything live.",
    checklist: [
      "Start with the smallest practical risk setting",
      "Validate bot reaction speed in demo mode first",
      "Use account-level stop conditions before scaling"
    ]
  }
};

const marketThemes = [
  {
    title: "Build context before execution",
    body: "Review the market state first so copy trading and bot workflows are enabled with better timing and more confidence.",
    icon: Radar
  },
  {
    title: "Use live pricing as your checklist",
    body: "Track ask, bid, and current feed status so you know whether you are viewing live ticks or an indicative fallback snapshot.",
    icon: Activity
  },
  {
    title: "Keep risk decisions visible",
    body: "Markets move fast. Use this page to slow down the process and confirm whether your next action still matches your rules.",
    icon: ShieldAlert
  }
] as const;


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
function getFeedPresentation(status: QuoteFeedStatus) {
  if (status === "live") {
    return {
      label: "Live",
      className: "text-success",
      badgeClass: "bg-success/10 text-success"
    };
  }

  if (status === "mixed") {
    return {
      label: "Mixed",
      className: "text-accent",
      badgeClass: "bg-accent/10 text-accent"
    };
  }

  if (status === "loading") {
    return {
      label: "Loading",
      className: "text-accent",
      badgeClass: "bg-accent/10 text-accent"
    };
  }

  return {
    label: "Fallback",
    className: "text-warning",
    badgeClass: "bg-warning/10 text-warning"
  };
}

function isDerivNativeMarket(quote: MarketQuote) {
  return quote.symbol.startsWith("R_") || /HZ\d+V$/i.test(quote.symbol) || /step index|volatility/i.test(quote.label);
}

function getDynamicDerivDetail(quote: MarketQuote): MarketDetail {
  if (/step index/i.test(quote.label)) {
    return {
      chartProvider: "deriv",
      category: "Synthetic step index",
      headline: `Use ${quote.label} when you want a structured synthetic market for testing trigger logic, execution speed, and rule-based reactions.`,
      context: `${quote.label} can help you validate whether your bot conditions and copy settings stay disciplined in a market that moves in a controlled synthetic pattern on Deriv.`,
      checklist: [
        "Start with demo sizing before enabling live execution",
        "Check whether your strategy depends on sudden breaks or steady moves",
        "Keep stop conditions visible before increasing allocation"
      ]
    };
  }

  return {
    chartProvider: "deriv",
    category: /volatility/i.test(quote.label) ? "Synthetic volatility index" : "Synthetic index",
    headline: `Use ${quote.label} when you want a 24/7 Deriv-native synthetic market for testing automation, reaction speed, and risk rules.`,
    context: `${quote.label} is better viewed on Deriv data directly, so you can evaluate live movement, risk exposure, and execution timing without relying on unsupported external chart symbols.`,
    checklist: [
      "Validate the strategy on demo before scaling risk",
      "Watch spread, pace, and candle behavior before enabling copying",
      "Use account-level drawdown and stop conditions from the start"
    ]
  };
}

function getMarketDetail(quote: MarketQuote | undefined) {
  if (!quote) {
    return marketDetails.frxEURUSD;
  }

  const existing = marketDetails[quote.symbol];
  if (existing) {
    return existing;
  }

  if (isDerivNativeMarket(quote)) {
    return getDynamicDerivDetail(quote);
  }

  return marketDetails.frxEURUSD;
}

function inferSpread(symbol: string, pipSize: number) {
  const pipUnit = 10 ** -pipSize;

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /STEP/i.test(symbol)) {
    return pipUnit * 6;
  }

  return pipUnit * 4;
}

function mergeQuotes(currentQuotes: MarketQuote[], incomingQuotes: MarketQuote[]) {
  const currentMap = new Map(currentQuotes.map((quote) => [quote.symbol, quote]));

  return incomingQuotes.map((incoming) => {
    const current = currentMap.get(incoming.symbol);
    if (!current) {
      return incoming;
    }

    if (current.source === "live" && incoming.source === "fallback") {
      return {
        ...incoming,
        ask: current.ask,
        bid: current.bid,
        mid: current.mid,
        updatedAt: current.updatedAt,
        source: current.source
      };
    }

    return incoming;
  });
}

function deriveFeedStatus(quotes: MarketQuote[], isInitialLoading: boolean): QuoteFeedStatus {
  if (isInitialLoading && quotes.length === 0) {
    return "loading";
  }

  const liveCount = quotes.filter((quote) => quote.source === "live").length;
  if (liveCount === 0) {
    return "fallback";
  }

  if (liveCount === quotes.length) {
    return "live";
  }

  return "mixed";
}

export default function MarketsPage() {
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>(fallbackMarketQuotes);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(fallbackMarketQuotes[0]?.symbol ?? "frxEURUSD");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [quoteDirections, setQuoteDirections] = useState<QuoteDirectionMap>({});
  const liveSymbolsSeenRef = useRef<Set<string>>(new Set());
  const previousQuotesRef = useRef<Record<string, MarketQuote>>({});

  useEffect(() => {
    let active = true;

    const loadQuotes = async () => {
      try {
        const response = await apiRequest<MarketQuoteResponse>("/api/v1/deriv/market-watchlist");
        if (!active || response.quotes.length === 0) {
          return;
        }

        setMarketQuotes((current) => mergeQuotes(current, response.quotes));
        setSelectedSymbol((current) => {
          if (response.quotes.some((quote) => quote.symbol === current)) {
            return current;
          }

          return response.quotes[0]?.symbol ?? current;
        });
      } catch {
        if (!active) {
          return;
        }
      } finally {
        if (active) {
          setIsInitialLoading(false);
        }
      }
    };

    void loadQuotes();
    const interval = window.setInterval(() => {
      void loadQuotes();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (marketQuotes.length === 0) {
      return;
    }

    let active = true;
    const symbols = marketQuotes.map((quote) => quote.symbol);
    const quoteSocket = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);
    const liveTimeout = window.setTimeout(() => {
      if (!active) {
        return;
      }

      setMarketQuotes((current) =>
        current.map((quote) =>
          liveSymbolsSeenRef.current.has(quote.symbol)
            ? quote
            : {
                ...quote,
                source: quote.source === "live" ? "live" : "fallback"
              }
        )
      );
    }, 6000);

    quoteSocket.onopen = () => {
      for (const symbol of symbols) {
        quoteSocket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      }
    };

    quoteSocket.onmessage = (event) => {
      if (!active) {
        return;
      }

      try {
        const message = JSON.parse(String(event.data)) as DerivTickMessage;
        const tick = message.tick;

        if (message.msg_type !== "tick" || !tick?.symbol || typeof tick.quote !== "number") {
          return;
        }

        liveSymbolsSeenRef.current.add(tick.symbol);
        const pipSize = tick.pip_size ?? 2;
        const spread = inferSpread(tick.symbol, pipSize);
        const ask = (tick.quote + spread / 2).toFixed(Math.max(pipSize, 2));
        const bid = (tick.quote - spread / 2).toFixed(Math.max(pipSize, 2));
        const mid = tick.quote.toFixed(Math.max(pipSize, 2));
        const updatedAt = new Date((tick.epoch ?? Date.now() / 1000) * 1000).toISOString();

        setMarketQuotes((current) =>
          current.map((quote) =>
            quote.symbol === tick.symbol
              ? {
                  ...quote,
                  ask,
                  bid,
                  mid,
                  updatedAt,
                  source: "live"
                }
              : quote
          )
        );
      } catch {
        // Ignore individual message parse issues and continue streaming live ticks.
      }
    };

    quoteSocket.onerror = () => {
      if (!active) {
        return;
      }

      setMarketQuotes((current) =>
        current.map((quote) => ({
          ...quote,
          source: liveSymbolsSeenRef.current.has(quote.symbol) ? "live" : "fallback"
        }))
      );
    };

    return () => {
      active = false;
      window.clearTimeout(liveTimeout);
      quoteSocket.close();
    };
  }, [marketQuotes.map((quote) => quote.symbol).join("|")]);


  useEffect(() => {
    if (marketQuotes.length === 0) {
      return;
    }

    const nextDirections = marketQuotes.reduce<QuoteDirectionMap>((accumulator, quote) => {
      const previousQuote = previousQuotesRef.current[quote.symbol];
      accumulator[quote.symbol] = {
        ask: getPriceDirection(previousQuote?.ask, quote.ask),
        bid: getPriceDirection(previousQuote?.bid, quote.bid),
        mid: getPriceDirection(previousQuote?.mid, quote.mid)
      };
      return accumulator;
    }, {});

    previousQuotesRef.current = Object.fromEntries(marketQuotes.map((quote) => [quote.symbol, quote]));
    setQuoteDirections(nextDirections);
  }, [marketQuotes]);
  const feedStatus = useMemo(() => deriveFeedStatus(marketQuotes, isInitialLoading), [marketQuotes, isInitialLoading]);

  const selectedMarket = useMemo(() => {
    return marketQuotes.find((quote) => quote.symbol === selectedSymbol) ?? marketQuotes[0] ?? fallbackMarketQuotes[0];
  }, [marketQuotes, selectedSymbol]);

  const selectedDetail = getMarketDetail(selectedMarket);
  const boardPresentation = getFeedPresentation(feedStatus);
  const selectedPresentation = getFeedPresentation(isInitialLoading && !selectedMarket ? "loading" : selectedMarket?.source ?? "fallback");

  const updatedLabel = useMemo(() => {
    if (!selectedMarket?.updatedAt || selectedMarket.updatedAt === new Date(0).toISOString()) {
      return feedStatus === "loading" ? "Connecting to feed" : "Waiting for market update";
    }

    const time = new Date(selectedMarket.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    if (selectedMarket.source === "live") {
      return `Live ${time}`;
    }

    if (feedStatus === "mixed") {
      return `Mixed ${time}`;
    }

    return `Indicative ${time}`;
  }, [feedStatus, selectedMarket]);

  const chartSourceLabel = selectedDetail.chartProvider === "deriv" ? "Deriv native chart" : "TradingView chart";

  const handleDerivQuoteUpdate = (quote: { ask: string; bid: string; mid: string; updatedAt: string; source: "live" }) => {
    liveSymbolsSeenRef.current.add(selectedSymbol);
    setMarketQuotes((current) =>
      current.map((entry) => (entry.symbol === selectedSymbol ? { ...entry, ...quote } : entry))
    );
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:space-y-8 sm:py-10">
        <section className="panel overflow-hidden p-5 sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-secondary text-xs tracking-[0.22em] text-accent">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Market workspace
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl lg:max-w-3xl lg:text-5xl">
                Read live market context before you enable copy trading or automation.
              </h1>
              <p className="descriptive-copy mx-auto mt-4 max-w-2xl text-sm text-slate-300 sm:text-base lg:mx-0">
                Use FixCapital Markets to compare instruments, inspect live quotes, and understand the current environment before you let a trader or bot act on your account.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-muted p-4 text-center sm:text-left">
                <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Board status</p>
                <p className={`mt-2 text-lg font-semibold ${boardPresentation.className}`}>{boardPresentation.label}</p>
              </div>
              <div className="panel-muted p-4 text-center sm:text-left">
                <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Selected market</p>
                <p className={`mt-2 text-lg font-semibold ${selectedPresentation.className}`}>{selectedPresentation.label}</p>
              </div>
              <div className="panel-muted p-4 text-center sm:text-left">
                <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Updated</p>
                <p className="mt-2 text-lg font-semibold text-white">{updatedLabel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="panel flex h-[920px] min-h-[620px] flex-col p-5 sm:h-[980px] sm:p-6 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
            <div className="flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-accent" />
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Live watchlist</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Choose your market</h2>
              </div>
            </div>
            {feedStatus === "mixed" ? (
              <div className="descriptive-copy rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-xs text-accent">
                Some instruments are streaming live while others are still waiting on a fresh tick. Synthetic indices should keep switching back to live as soon as Deriv pushes the next update.
              </div>
            ) : null}
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0 scrollbar-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="space-y-3">
              {marketQuotes.map((quote) => {
                const isActive = quote.symbol === selectedSymbol;
                const quoteDetail = getMarketDetail(quote);
                const quotePresentation = getFeedPresentation(isInitialLoading && quote.updatedAt === new Date(0).toISOString() ? "loading" : quote.source);

                return (
                  <button
                    key={quote.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(quote.symbol)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isActive
                        ? "border-accent/40 bg-accent/10 shadow-[0_0_0_1px_rgba(87,212,168,0.16)]"
                        : "border-border/70 bg-card/60 hover:border-accent/20 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{quote.label}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="descriptive-copy text-xs text-slate-400">{quoteDetail.category}</p>
                          <span className="rounded-full bg-muted/50 px-2 py-0.5 font-secondary text-[10px] uppercase tracking-[0.12em] text-slate-300">
                            {quoteDetail.chartProvider === "deriv" ? "Deriv chart" : "TradingView"}
                          </span>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 font-secondary text-[11px] ${quotePresentation.badgeClass}`}>
                        {quotePresentation.label}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {([
                        ["Ask", quote.ask, quoteDirections[quote.symbol]?.ask ?? "flat"],
                        ["Bid", quote.bid, quoteDirections[quote.symbol]?.bid ?? "flat"],
                        ["Mid", quote.mid, quoteDirections[quote.symbol]?.mid ?? "flat"]
                      ] as const).map(([label, value, direction]) => {
                        const presentation = getDirectionPresentation(direction);
                        const Icon = presentation.icon;

                        return (
                          <div key={label}>
                            <p className="descriptive-copy text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                            <div className={`price-copy mt-1 flex items-center gap-1.5 text-sm font-semibold ${presentation.className}`}>
                              <Icon className="h-3.5 w-3.5" />
                              <span>{value}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div></div>
          </div>

          <div className="grid gap-4">
            <div className="panel overflow-hidden p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Selected market</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{selectedMarket?.label ?? "EUR/USD"}</h2>
                  <p className="descriptive-copy mt-3 max-w-2xl text-sm text-slate-300">{selectedDetail.headline}</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-muted/40 px-4 py-3">
                  <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Market context</p>
                  <p className="mt-1 font-semibold text-white">{selectedDetail.category}</p>
                  <p className="descriptive-copy mt-1 text-xs text-slate-400">{chartSourceLabel}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {selectedMarket
                  ? ([
                      ["Ask", selectedMarket.ask, quoteDirections[selectedMarket.symbol]?.ask ?? "flat"],
                      ["Bid", selectedMarket.bid, quoteDirections[selectedMarket.symbol]?.bid ?? "flat"],
                      ["Mid", selectedMarket.mid, quoteDirections[selectedMarket.symbol]?.mid ?? "flat"]
                    ] as const).map(([label, value, direction]) => {
                      const presentation = getDirectionPresentation(direction);
                      const Icon = presentation.icon;

                      return (
                        <div key={label} className="panel-muted p-4">
                          <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                          <div className={`price-copy mt-2 flex items-center gap-2 text-xl font-semibold ${presentation.className}`}>
                            <Icon className="h-4 w-4" />
                            <span>{value}</span>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
              <div className="mt-4 rounded-3xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
                <span className="descriptive-copy">
                  Always validate new copy relationships and bot logic on demo first. Fast-moving markets can amplify risk if sizing and guardrails are not already defined.
                </span>
              </div>
            </div>

            {selectedDetail.chartProvider === "deriv" ? (
              <DerivMarketChart
                symbol={selectedMarket?.symbol ?? "R_100"}
                label={selectedMarket?.label ?? "R_100"}
                onQuoteUpdate={handleDerivQuoteUpdate}
              />
            ) : (
              <TradingViewWidget symbol={selectedDetail.tvSymbol ?? "FX:EURUSD"} />
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {marketThemes.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="panel p-5 sm:p-6">
                <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">{item.title}</h2>
                <p className="descriptive-copy mt-3 text-sm text-slate-300">{item.body}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="panel p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-accent" />
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Execution context</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Before you enable copying or automation</h2>
              </div>
            </div>
            <p className="descriptive-copy mt-4 max-w-2xl text-sm text-slate-300">{selectedDetail.context}</p>
            <ul className="mt-5 space-y-3">
              {selectedDetail.checklist.map((item) => (
                <li key={item} className="descriptive-copy flex items-start gap-3 text-sm text-slate-200">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 flex-none text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-accent" />
              <div>
                <p className="descriptive-copy text-xs uppercase tracking-[0.24em] text-slate-400">Market routine</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">A cleaner pre-trade workflow</h2>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {[
                "Check whether you are seeing live ticks or fallback quotes",
                "Review spread, price context, and current volatility",
                "Confirm your risk settings before enabling execution",
                "Use demo mode for any strategy you have not validated yet"
              ].map((item, index) => (
                <div key={item} className="panel-muted flex items-start gap-3 p-4">
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent/10 font-secondary text-xs text-accent">
                    0{index + 1}
                  </span>
                  <p className="descriptive-copy text-sm text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
