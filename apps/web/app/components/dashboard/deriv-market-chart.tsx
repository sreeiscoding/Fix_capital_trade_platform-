"use client";

import { Activity, CandlestickChart, ExternalLink, RefreshCw } from "lucide-react";
import { createChart, ColorType, type CandlestickData, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
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

type DerivCandle = {
  epoch?: number;
  open_time?: number;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
};

type DerivChartMessage = {
  msg_type?: string;
  candles?: DerivCandle[];
  ohlc?: DerivCandle;
  history?: {
    candles?: DerivCandle[];
    prices?: Array<number | string>;
    times?: number[];
  };
  tick?: {
    quote?: number;
    epoch?: number;
    pip_size?: number;
  };
  error?: {
    message?: string;
  };
};

type QuoteUpdate = {
  ask: string;
  bid: string;
  mid: string;
  updatedAt: string;
  source: "live";
};

type DerivMarketChartProps = {
  symbol: string;
  label: string;
  onQuoteUpdate?: (quote: QuoteUpdate) => void;
};

type TimeframeOption = {
  key: string;
  label: string;
  granularity: number;
  count: number;
};

const DERIV_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL ?? "wss://ws.derivws.com/websockets/v3";
const DERIV_PUBLIC_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089";
const DERIV_MT5_WEB_TERMINAL_URL = "https://deriv.com/trading-platforms/mt5/web-terminal";
const TIMEFRAMES: readonly TimeframeOption[] = [
  { key: "1m", label: "1m", granularity: 60, count: 120 },
  { key: "5m", label: "5m", granularity: 300, count: 120 },
  { key: "15m", label: "15m", granularity: 900, count: 100 },
  { key: "1h", label: "1h", granularity: 3600, count: 72 }
] as const;

function parseNumericValue(value: number | string | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCandles(candles: DerivCandle[]) {
  return candles
    .map((candle) => {
      const open = parseNumericValue(candle.open);
      const high = parseNumericValue(candle.high);
      const low = parseNumericValue(candle.low);
      const close = parseNumericValue(candle.close);
      const time = candle.epoch ?? candle.open_time;

      if (open === null || high === null || low === null || close === null || typeof time !== "number") {
        return null;
      }

      return {
        time: time as Time,
        open,
        high,
        low,
        close
      } satisfies CandlestickData<Time>;
    })
    .filter((candle): candle is CandlestickData<Time> => candle !== null)
    .sort((left, right) => Number(left.time) - Number(right.time));
}

function normalizeHistoryPoints(prices: Array<number | string>, times: number[]) {
  return times
    .map((time, index) => {
      const value = parseNumericValue(prices[index]);
      if (value === null) {
        return null;
      }

      return {
        time,
        value
      } satisfies MarketHistoryPoint;
    })
    .filter((point): point is MarketHistoryPoint => point !== null)
    .sort((left, right) => left.time - right.time);
}

function buildCandlesFromPoints(points: MarketHistoryPoint[], granularity: number, count: number) {
  const buckets = new Map<number, CandlestickData<Time>>();

  for (const point of points) {
    const candleEpoch = Math.floor(point.time / granularity) * granularity;
    const existing = buckets.get(candleEpoch);

    if (!existing) {
      buckets.set(candleEpoch, {
        time: candleEpoch as Time,
        open: point.value,
        high: point.value,
        low: point.value,
        close: point.value
      });
      continue;
    }

    buckets.set(candleEpoch, {
      ...existing,
      high: Math.max(existing.high, point.value),
      low: Math.min(existing.low, point.value),
      close: point.value
    });
  }

  return [...buckets.values()]
    .sort((left, right) => Number(left.time) - Number(right.time))
    .slice(-count);
}

function upsertTickIntoCandles(
  current: CandlestickData<Time>[],
  point: MarketHistoryPoint,
  granularity: number,
  count: number
) {
  const candleEpoch = Math.floor(point.time / granularity) * granularity;
  const next = [...current];
  const existingIndex = next.findIndex((item) => Number(item.time) === candleEpoch);

  if (existingIndex >= 0) {
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      high: Math.max(existing.high, point.value),
      low: Math.min(existing.low, point.value),
      close: point.value
    };
  } else {
    next.push({
      time: candleEpoch as Time,
      open: point.value,
      high: point.value,
      low: point.value,
      close: point.value
    });
  }

  return next.sort((left, right) => Number(left.time) - Number(right.time)).slice(-count);
}

function inferSpread(symbol: string, pipSize: number) {
  const pipUnit = 10 ** -pipSize;

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /STEP/i.test(symbol)) {
    return pipUnit * 6;
  }

  return pipUnit * 4;
}

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

export function DerivMarketChart({ symbol, label, onQuoteUpdate }: DerivMarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAMES[0]);
  const [candles, setCandles] = useState<CandlestickData<Time>[]>([]);
  const [fallbackPoints, setFallbackPoints] = useState<MarketHistoryPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

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

      const series = chart.addCandlestickSeries({
        upColor: "#57d4a8",
        downColor: "#f97373",
        borderVisible: false,
        wickUpColor: "#57d4a8",
        wickDownColor: "#f97373",
        priceLineVisible: true,
        lastValueVisible: true
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
    let chartSocket: WebSocket | null = null;
    let quoteSocket: WebSocket | null = null;
    let fallbackInterval: number | null = null;
    let fallbackStarted = false;
    let receivedLiveCandles = false;

    const loadFallbackHistory = async () => {
      try {
        const response = await apiRequest<MarketHistoryResponse>(`/api/v1/deriv/market-history?symbol=${encodeURIComponent(symbol)}&count=120`);
        if (!active) {
          return;
        }

        setFallbackPoints(response.points);
        setStatus(response.source === "live" ? "live" : "fallback");
        if (response.points.length > 0) {
          setLastUpdatedAt(new Date(response.points[response.points.length - 1].time * 1000).toISOString());
        }
      } catch {
        if (!active) {
          return;
        }

        setStatus("fallback");
      }
    };

    const startFallback = () => {
      if (!active || fallbackStarted || receivedLiveCandles) {
        return;
      }

      fallbackStarted = true;
      void loadFallbackHistory();
      fallbackInterval = window.setInterval(() => {
        void loadFallbackHistory();
      }, 5000);
    };

    setCandles([]);
    setFallbackPoints([]);
    setStatus("loading");
    setLastUpdatedAt("");

    const liveTimeout = window.setTimeout(() => {
      if (!receivedLiveCandles) {
        startFallback();
      }
    }, 6000);

    try {
      chartSocket = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);
      chartSocket.onopen = () => {
        chartSocket?.send(
          JSON.stringify({
            ticks_history: symbol,
            count: timeframe.count,
            end: "latest",
            style: "candles",
            granularity: timeframe.granularity,
            subscribe: 1
          })
        );
      };

      chartSocket.onmessage = (event) => {
        if (!active) {
          return;
        }

        try {
          const message = JSON.parse(String(event.data)) as DerivChartMessage;

          if (message.error) {
            startFallback();
            return;
          }

          const candlePayload = message.candles ?? message.history?.candles;
          if (candlePayload && candlePayload.length > 0) {
            const nextCandles = normalizeCandles(candlePayload);
            if (nextCandles.length > 0) {
              receivedLiveCandles = true;
              setCandles(nextCandles);
              setStatus("live");
              setLastUpdatedAt(new Date(Number(nextCandles[nextCandles.length - 1].time) * 1000).toISOString());
            }
            return;
          }

          if (message.history?.prices && message.history.times) {
            const points = normalizeHistoryPoints(message.history.prices, message.history.times);
            const nextCandles = buildCandlesFromPoints(points, timeframe.granularity, timeframe.count);
            if (nextCandles.length > 0) {
              receivedLiveCandles = true;
              setCandles(nextCandles);
              setStatus("live");
              setLastUpdatedAt(new Date(Number(nextCandles[nextCandles.length - 1].time) * 1000).toISOString());
            }
            return;
          }

          if (message.ohlc) {
            const [nextCandle] = normalizeCandles([message.ohlc]);
            if (!nextCandle) {
              return;
            }

            receivedLiveCandles = true;
            setStatus("live");
            setLastUpdatedAt(new Date(Number(nextCandle.time) * 1000).toISOString());
            setCandles((current) => {
              const next = [...current];
              const existingIndex = next.findIndex((item) => Number(item.time) === Number(nextCandle.time));

              if (existingIndex >= 0) {
                next[existingIndex] = nextCandle;
              } else {
                next.push(nextCandle);
              }

              return next.sort((left, right) => Number(left.time) - Number(right.time)).slice(-timeframe.count);
            });
            return;
          }

          if (message.msg_type === "tick" && typeof message.tick?.quote === "number") {
            const point = {
              time: Math.floor(message.tick.epoch ?? Date.now() / 1000),
              value: message.tick.quote
            } satisfies MarketHistoryPoint;

            receivedLiveCandles = true;
            setStatus("live");
            setLastUpdatedAt(new Date(point.time * 1000).toISOString());
            setCandles((current) => upsertTickIntoCandles(current, point, timeframe.granularity, timeframe.count));
          }
        } catch {
          startFallback();
        }
      };

      chartSocket.onerror = () => {
        startFallback();
      };

      chartSocket.onclose = () => {
        if (!receivedLiveCandles) {
          startFallback();
        }
      };

      quoteSocket = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);
      quoteSocket.onopen = () => {
        quoteSocket?.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      };

      quoteSocket.onmessage = (event) => {
        if (!active) {
          return;
        }

        try {
          const message = JSON.parse(String(event.data)) as DerivChartMessage;
          const quote = message.tick?.quote;
          const epoch = message.tick?.epoch;
          const pipSize = message.tick?.pip_size ?? 2;

          if (typeof quote !== "number") {
            return;
          }

          const spread = inferSpread(symbol, pipSize);
          const ask = quote + spread / 2;
          const bid = quote - spread / 2;

          onQuoteUpdate?.({
            ask: ask.toFixed(Math.max(pipSize, 2)),
            bid: bid.toFixed(Math.max(pipSize, 2)),
            mid: quote.toFixed(Math.max(pipSize, 2)),
            updatedAt: new Date((epoch ?? Date.now() / 1000) * 1000).toISOString(),
            source: "live"
          });
        } catch {
          // Ignore quote stream parse errors and keep the chart session alive.
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
      chartSocket?.close();
      quoteSocket?.close();
    };
  }, [symbol, timeframe, onQuoteUpdate]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    if (candles.length > 0) {
      seriesRef.current.setData(candles);
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "Waiting for chart data";
    }

    return new Date(lastUpdatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }, [lastUpdatedAt]);

  const sparklinePath = useMemo(() => buildSparklinePath(fallbackPoints, 900, 360), [fallbackPoints]);

  return (
    <section className="panel overflow-hidden p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <CandlestickChart className="h-4 w-4" />
            <p className="descriptive-copy text-xs uppercase tracking-[0.22em]">Deriv native candlestick chart</p>
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-white">{label} on Deriv data</h3>
          <p className="descriptive-copy mt-2 max-w-2xl text-sm text-slate-300">
            This synthetic chart is built from live Deriv market data with candle timeframes, so it behaves much closer to a real trading chart than a generic widget.
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
          <a
            href={DERIV_MT5_WEB_TERMINAL_URL}
            target="_blank"
            rel="noreferrer"
            className="descriptive-copy inline-flex items-center gap-2 text-xs text-accent transition hover:text-white sm:justify-end"
          >
            Open Deriv MT5 web terminal
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TIMEFRAMES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTimeframe(option)}
            className={`rounded-full px-3 py-1 font-secondary text-xs transition ${
              option.key === timeframe.key
                ? "bg-accent text-slate-950"
                : "border border-border/70 bg-card/70 text-slate-300 hover:border-accent/30 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative h-[360px] overflow-hidden rounded-[1.5rem] border border-border/70 bg-slate-950/70 sm:h-[520px]">
        <div ref={containerRef} className={`h-full w-full ${chartError ? "hidden" : "block"}`} />

        {chartError && fallbackPoints.length > 0 ? (
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

        {candles.length === 0 && fallbackPoints.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center">
            <div className="space-y-3">
              <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-accent/15" />
              <p className="text-sm font-medium text-white">Preparing Deriv chart</p>
              <p className="descriptive-copy text-xs text-slate-400">Loading live candles for {label} on the selected timeframe.</p>
            </div>
          </div>
        ) : null}

        {chartError ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 font-secondary text-xs text-warning sm:left-6 sm:top-6">
            Showing inline fallback chart
          </div>
        ) : null}

        {!chartReady && (candles.length > 0 || fallbackPoints.length > 0) && !chartError ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-secondary text-xs text-accent sm:left-6 sm:top-6">
            Preparing chart canvas
          </div>
        ) : null}
      </div>
    </section>
  );
}
