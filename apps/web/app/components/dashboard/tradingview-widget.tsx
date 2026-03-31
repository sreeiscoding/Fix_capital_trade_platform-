"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DerivMarketChart } from "@/components/dashboard/deriv-market-chart";

type TradingViewWidgetProps = {
  symbol?: string;
};

type DerivFallbackConfig = {
  symbol: string;
  label: string;
};

const TRADINGVIEW_EMBED_URL = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
const TRADINGVIEW_FALLBACK_MARKETS: Record<string, DerivFallbackConfig> = {
  "FX:EURUSD": { symbol: "frxEURUSD", label: "EUR/USD" },
  "OANDA:XAUUSD": { symbol: "frxXAUUSD", label: "XAU/USD" },
  "FX:GBPJPY": { symbol: "frxGBPJPY", label: "GBP/JPY" }
};

export function TradingViewWidget({ symbol = "FX:EURUSD" }: TradingViewWidgetProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;

    if (!host || shouldLoad) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, [shouldLoad]);

  useEffect(() => {
    const container = containerRef.current;
    if (!shouldLoad || !container) {
      return;
    }

    setHasError(false);
    container.innerHTML = "";

    const widgetRoot = document.createElement("div");
    widgetRoot.className = "tradingview-widget-container__widget h-full w-full";
    widgetRoot.style.height = "calc(100% - 32px)";
    widgetRoot.style.width = "100%";
    container.appendChild(widgetRoot);

    const script = document.createElement("script");
    script.src = TRADINGVIEW_EMBED_URL;
    script.type = "text/javascript";
    script.async = true;
    script.onerror = () => {
      setHasError(true);
    };
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      save_image: false,
      backgroundColor: "#0b1220",
      gridColor: "rgba(255,255,255,0.06)",
      hide_top_toolbar: false,
      hide_legend: false,
      withdateranges: true,
      studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"],
      support_host: "https://www.tradingview.com"
    });

    container.appendChild(script);

    const renderTimeout = window.setTimeout(() => {
      if (!container.querySelector("iframe")) {
        setHasError(true);
      }
    }, 6000);

    return () => {
      window.clearTimeout(renderTimeout);
      container.innerHTML = "";
    };
  }, [shouldLoad, symbol]);

  const fallbackMarket = TRADINGVIEW_FALLBACK_MARKETS[symbol];

  if (hasError && fallbackMarket) {
    return <DerivMarketChart symbol={fallbackMarket.symbol} label={fallbackMarket.label} />;
  }

  return (
    <div ref={hostRef} className="panel relative h-[360px] overflow-hidden p-2 sm:h-[520px]">
      {!shouldLoad ? (
        <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border border-border/60 bg-slate-950/40 text-center">
          <div className="space-y-3 px-6">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-accent/15" />
            <p className="text-sm font-medium text-white">Preparing live chart</p>
            <p className="descriptive-copy text-xs text-slate-400">
              The advanced TradingView widget loads as this section approaches the viewport.
            </p>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={`tradingview-widget-container h-full w-full ${shouldLoad ? "block" : "hidden"}`}
      />

      {hasError && !fallbackMarket ? (
        <div className="absolute inset-x-6 top-6 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span className="descriptive-copy">
              TradingView could not be loaded right now. Refresh the page or try again in a moment.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
