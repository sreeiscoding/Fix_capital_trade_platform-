"use client";

import { useEffect, useRef, useState } from "react";

export function TradingViewWidget({ symbol = "FX:EURUSD" }: { symbol?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

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
    if (!shouldLoad || !containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
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
      studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"]
    });

    containerRef.current.appendChild(script);
  }, [shouldLoad, symbol]);

  return (
    <div ref={hostRef} className="panel h-[360px] overflow-hidden p-2 sm:h-[520px]">
      {shouldLoad ? (
        <div className="tradingview-widget-container h-full w-full" ref={containerRef} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border border-border/60 bg-slate-950/40 text-center">
          <div className="space-y-3 px-6">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-accent/15" />
            <p className="text-sm font-medium text-white">Preparing live chart</p>
            <p className="text-xs text-slate-400">The advanced TradingView widget loads only when this section is near the viewport.</p>
          </div>
        </div>
      )}
    </div>
  );
}