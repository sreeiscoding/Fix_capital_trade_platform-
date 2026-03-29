"use client";

import { Activity, AreaChart, RefreshCw } from "lucide-react";
import { createChart, ColorType, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

type MarketHistoryPoint = {
  time: number;
  value: number;
};

type MarketHistoryResponse = {
  source: "live" | "fallback";
  points: MarketHistoryPoint[];
};

type DerivHistoryMessage = {
  msg_type?: string;
  history?: {
    prices?: Array<number | string>;
    times?: number[];
  };
  tick?: {
    quote?: number;
    epoch?: number;
  };
  error?: {
    message?: string;
  };
};

type DerivMarketChartProps = {
  symbol: string;
  label: string;
};

const DERIV_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL ?? "wss://ws.derivws.com/websockets/v3";
const DERIV_PUBLIC_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089";

function buildSparklinePath(points: MarketHistoryPoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }

  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function normalizeHistoryPoints(prices: Array<number | string>, times: number[]) {
  return times
    .map((time, index) => {
      const rawPrice = prices[index];
      const value = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);

      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        time,
        value
      };
    })
    .filter((point): point is MarketHistoryPoint => point !== null);
}

export function DerivMarketChart({ symbol, label }: DerivMarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [points, setPoints] = useState<MarketHistoryPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    try {
      const chart = createChart(container, {
        width: Math.max(container.clientWidth, 320),
        height: Math.max(container.clientHeight, 360),
        layout: {
          background: { type: ColorType.Solid, color: "#0b1220" },
          textColor: "#94a3b8",
          fontFamily: "var(--font-secondary), monospace"
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.05)" }
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.08)"
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.08)",
          timeVisible: true,
          secondsVisible: false
        },
        crosshair: {
          vertLine: { color: "rgba(87,212,168,0.28)" },
          horzLine: { color: "rgba(87,212,168,0.18)" }
        }
      });

      const series = chart.addAreaSeries({
        lineColor: "#57d4a8",
        topColor: "rgba(87,212,168,0.28)",
        bottomColor: "rgba(87,212,168,0.02)",
        lineWidth: 2,
        priceLineColor: "#57d4a8"
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);
      setChartError(false);

      const resizeObserver = new ResizeObserver((entries) => {
        const nextWidth = entries[0]?.contentRect.width;
        const nextHeight = entries[0]?.contentRect.height;

        if (nextWidth && nextHeight) {
          chart.applyOptions({ width: nextWidth, height: nextHeight });
        }
      });

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        setChartReady(false);
      };
    } catch {
      setChartError(true);
      setChartReady(false);
      return;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let fallbackInterval: number | null = null;
    let fallbackStarted = false;
    let receivedLiveData = false;

    const loadFallbackHistory = async () => {
      try {
        const response = await apiRequest<MarketHistoryResponse>(`/api/v1/deriv/market-history?symbol=${encodeURIComponent(symbol)}&count=120`);
        if (!active) {
          return;
        }

        setPoints(response.points);
        setStatus(response.source === "live" ? "live" : "fallback");
      } catch {
        if (!active) {
          return;
        }

        setStatus("fallback");
      }
    };

    const startFallback = () => {
      if (!active || fallbackStarted || receivedLiveData) {
        return;
      }

      fallbackStarted = true;
      void loadFallbackHistory();
      fallbackInterval = window.setInterval(() => {
        void loadFallbackHistory();
      }, 5000);
    };

    setPoints([]);
    setStatus("loading");

    const liveTimeout = window.setTimeout(() => {
      if (!receivedLiveData) {
        startFallback();
      }
    }, 6000);

    try {
      ws = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            ticks_history: symbol,
            adjust_start_time: 1,
            end: "latest",
            count: 120,
            style: "ticks",
            subscribe: 1
          })
        );
      };

      ws.onmessage = (event) => {
        if (!active) {
          return;
        }

        try {
          const message = JSON.parse(String(event.data)) as DerivHistoryMessage;

          if (message.error) {
            startFallback();
            return;
          }

          if (message.msg_type === "history" && message.history?.prices && message.history.times) {
            const nextPoints = normalizeHistoryPoints(message.history.prices, message.history.times);
            if (nextPoints.length > 0) {
              receivedLiveData = true;
              setPoints(nextPoints);
              setStatus("live");
            }
            return;
          }

          if (message.msg_type === "tick" && typeof message.tick?.quote === "number") {
            const nextPoint = {
              time: Math.floor((message.tick.epoch ?? Date.now() / 1000)),
              value: message.tick.quote
            };

            receivedLiveData = true;
            setStatus("live");
            setPoints((current) => [...current.slice(-119), nextPoint]);
          }
        } catch {
          startFallback();
        }
      };

      ws.onerror = () => {
        startFallback();
      };

      ws.onclose = () => {
        if (!receivedLiveData) {
          startFallback();
        }
      };
    } catch {
      startFallback();
    }

    return () => {
      active = false;
      window.clearTimeout(liveTimeout);
      if (fallbackInterval) {
        window.clearInterval(fallbackInterval);
      }
      ws?.close();
    };
  }, [symbol]);

  useEffect(() => {
    if (!seriesRef.current || points.length === 0) {
      return;
    }

    const data = points.map((point) => ({
      time: point.time as Time,
      value: point.value
    }));

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  const lastPoint = points[points.length - 1];
  const lastUpdatedLabel = useMemo(() => {
    if (!lastPoint) {
      return "Waiting for chart data";
    }

    return new Date(lastPoint.time * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }, [lastPoint]);

  const sparklinePath = useMemo(() => buildSparklinePath(points, 900, 360), [points]);

  return (
    <section className="panel overflow-hidden p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <AreaChart className="h-4 w-4" />
            <p className="descriptive-copy text-xs uppercase tracking-[0.22em]">Deriv native chart</p>
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-white">{label} on Deriv data</h3>
          <p className="descriptive-copy mt-2 max-w-2xl text-sm text-slate-300">
            View this synthetic market on a native Deriv chart so you can follow its price action with the source that actually supports it.
          </p>
        </div>
        <div className="grid gap-2 text-left sm:text-right">
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 font-secondary text-xs sm:justify-end ${
              status === "live"
                ? "bg-success/10 text-success"
                : status === "loading"
                  ? "bg-accent/10 text-accent"
                  : "bg-warning/10 text-warning"
            }`}
          >
            <Activity className="mr-2 h-3.5 w-3.5" />
            {status === "live" ? "Live Deriv feed" : status === "loading" ? "Connecting to Deriv" : "Indicative fallback"}
          </span>
          <p className="descriptive-copy flex items-center gap-2 text-xs text-slate-400 sm:justify-end">
            <RefreshCw className="h-3.5 w-3.5" />
            Updated {lastUpdatedLabel}
          </p>
        </div>
      </div>

      <div className="relative h-[360px] overflow-hidden rounded-[1.5rem] border border-border/70 bg-slate-950/70 sm:h-[520px]">
        <div ref={containerRef} className={`h-full w-full ${chartError ? "hidden" : "block"}`} />

        {chartError && points.length > 0 ? (
          <div className="absolute inset-0 p-4 sm:p-6">
            <svg viewBox="0 0 900 360" className="h-full w-full" preserveAspectRatio="none" aria-label={`${label} fallback chart`}>
              <defs>
                <linearGradient id="derivSparkFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(87,212,168,0.35)" />
                  <stop offset="100%" stopColor="rgba(87,212,168,0.02)" />
                </linearGradient>
              </defs>
              <path d={`${sparklinePath} L 900 360 L 0 360 Z`} fill="url(#derivSparkFill)" opacity="0.9" />
              <path d={sparklinePath} fill="none" stroke="#57d4a8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : null}

        {points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center">
            <div className="space-y-3">
              <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-accent/15" />
              <p className="text-sm font-medium text-white">Preparing Deriv chart</p>
              <p className="descriptive-copy text-xs text-slate-400">Fetching native tick history for {label}.</p>
            </div>
          </div>
        ) : null}

        {chartError ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 font-secondary text-xs text-warning sm:left-6 sm:top-6">
            Showing inline fallback chart
          </div>
        ) : null}

        {!chartReady && points.length > 0 && !chartError ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-secondary text-xs text-accent sm:left-6 sm:top-6">
            Preparing chart canvas
          </div>
        ) : null}
      </div>
    </section>
  );
}
