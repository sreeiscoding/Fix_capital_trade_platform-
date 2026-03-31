"use client";

import { Activity, CandlestickChart, ExternalLink, MoveHorizontal, RefreshCw, Settings2, ZoomIn, ZoomOut } from "lucide-react";
import {
  createChart,
  ColorType,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

type MarketHistoryPoint = {
  time: number;
  value: number;
};

type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type MarketCandleResponse = {
  source: "live" | "fallback";
  candles: MarketCandle[];
  updatedAt: string;
};

type DerivTickMessage = {
  msg_type?: string;
  tick?: {
    quote?: number;
    epoch?: number;
    pip_size?: number;
  };
  error?: {
    message?: string;
  };
};
type DerivHistoryMessage = {
  msg_type?: string;
  candles?: Array<{
    epoch?: number;
    open?: number | string;
    high?: number | string;
    low?: number | string;
    close?: number | string;
  }>;
  history?: {
    candles?: Array<{
      epoch?: number;
      open?: number | string;
      high?: number | string;
      low?: number | string;
      close?: number | string;
    }>;
    prices?: Array<number | string>;
    times?: number[];
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

type IndicatorKey = "sma20" | "ema21" | "bb20";

type IndicatorState = Record<IndicatorKey, boolean>;

const DERIV_PUBLIC_WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL ?? "wss://ws.derivws.com/websockets/v3";
const DERIV_PUBLIC_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089";
const DERIV_MT5_WEB_TERMINAL_URL = "https://deriv.com/trading-platforms/mt5/web-terminal";
const TIMEFRAMES: readonly TimeframeOption[] = [
  { key: "1m", label: "1m", granularity: 60, count: 120 },
  { key: "5m", label: "5m", granularity: 300, count: 120 },
  { key: "15m", label: "15m", granularity: 900, count: 100 },
  { key: "1h", label: "1h", granularity: 3600, count: 72 }
] as const;
const DEFAULT_INDICATORS: IndicatorState = {
  sma20: true,
  ema21: false,
  bb20: false
};

function toChartCandles(candles: MarketCandle[]) {
  return candles
    .map((candle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }))
    .sort((left, right) => Number(left.time) - Number(right.time));
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

function parseNumericValue(value: number | string | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCandlesFromTickHistory(points: MarketHistoryPoint[], granularity: number) {
  const buckets = new Map<number, MarketCandle>();

  for (const point of points) {
    const candleTime = Math.floor(point.time / granularity) * granularity;
    const existing = buckets.get(candleTime);

    if (!existing) {
      buckets.set(candleTime, {
        time: candleTime,
        open: point.value,
        high: point.value,
        low: point.value,
        close: point.value
      });
      continue;
    }

    buckets.set(candleTime, {
      ...existing,
      high: Math.max(existing.high, point.value),
      low: Math.min(existing.low, point.value),
      close: point.value
    });
  }

  return [...buckets.values()].sort((left, right) => left.time - right.time);
}

async function fetchDirectDerivCandles(symbol: string, granularity: number, count: number) {
  return await new Promise<MarketCandleResponse>((resolve, reject) => {
    const socket = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);
    let settled = false;

    const cleanup = () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === window.WebSocket.OPEN || socket.readyState === window.WebSocket.CONNECTING) {
        socket.close();
      }
    };

    const settle = (value?: MarketCandleResponse, error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(value ?? { source: "fallback", candles: [], updatedAt: new Date().toISOString() });
    };

    const timeout = window.setTimeout(() => {
      settle(undefined, new Error("Timed out while fetching direct Deriv candles"));
    }, 7000);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          end: "latest",
          count,
          style: "candles",
          granularity
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as DerivHistoryMessage;

        if (message.error) {
          settle(undefined, new Error(message.error.message ?? "Failed to fetch direct Deriv candles"));
          return;
        }

        const candlePayload = message.candles ?? message.history?.candles;
        if (candlePayload && candlePayload.length > 0) {
          const candles = candlePayload
            .map((candle) => {
              const open = parseNumericValue(candle.open);
              const high = parseNumericValue(candle.high);
              const low = parseNumericValue(candle.low);
              const close = parseNumericValue(candle.close);
              const time = candle.epoch;

              if (open === null || high === null || low === null || close === null || typeof time !== "number") {
                return null;
              }

              return { time, open, high, low, close } satisfies MarketCandle;
            })
            .filter((candle): candle is MarketCandle => candle !== null)
            .sort((left, right) => left.time - right.time)
            .slice(-count);

          settle({
            source: "live",
            candles,
            updatedAt: new Date((candles[candles.length - 1]?.time ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
          });
          return;
        }

        if (message.history?.prices && message.history.times) {
          const points = message.history.times
            .map((time, index) => {
              const value = parseNumericValue(message.history?.prices?.[index]);
              if (value === null) {
                return null;
              }

              return { time, value } satisfies MarketHistoryPoint;
            })
            .filter((point): point is MarketHistoryPoint => point !== null);

          const candles = buildCandlesFromTickHistory(points, granularity).slice(-count);
          settle({
            source: "live",
            candles,
            updatedAt: new Date((candles[candles.length - 1]?.time ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
          });
        }
      } catch (error) {
        settle(undefined, error instanceof Error ? error : new Error("Failed to parse direct Deriv candles"));
      }
    };

    socket.onerror = () => {
      settle(undefined, new Error("Direct Deriv candle connection failed"));
    };
  });
}
function inferSpread(symbol: string, pipSize: number) {
  const pipUnit = 10 ** -pipSize;

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /STEP/i.test(symbol)) {
    return pipUnit * 6;
  }

  return pipUnit * 4;
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

function computeSma(candles: CandlestickData<Time>[], period: number) {
  const result: LineData<Time>[] = [];

  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1);
    const average = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
    result.push({ time: candles[index].time, value: average });
  }

  return result;
}

function computeEma(candles: CandlestickData<Time>[], period: number) {
  if (candles.length < period) {
    return [] as LineData<Time>[];
  }

  const multiplier = 2 / (period + 1);
  const seed = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  const result: LineData<Time>[] = [{ time: candles[period - 1].time, value: seed }];
  let previous = seed;

  for (let index = period; index < candles.length; index += 1) {
    const current = candles[index].close * multiplier + previous * (1 - multiplier);
    result.push({ time: candles[index].time, value: current });
    previous = current;
  }

  return result;
}

function computeBollingerBands(candles: CandlestickData<Time>[], period: number, deviations: number) {
  const upper: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  for (let index = period - 1; index < candles.length; index += 1) {
    const slice = candles.slice(index - period + 1, index + 1);
    const mean = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
    const variance = slice.reduce((sum, candle) => sum + (candle.close - mean) ** 2, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    const time = candles[index].time;

    middle.push({ time, value: mean });
    upper.push({ time, value: mean + standardDeviation * deviations });
    lower.push({ time, value: mean - standardDeviation * deviations });
  }

  return { upper, middle, lower };
}

function getChartDescription(symbol: string, label: string) {
  if (symbol.startsWith("frx")) {
    return `This forex chart loads ${label} candle history first, then keeps the view fresh with live price updates so you can read structure, momentum, and overlays without waiting on a blank panel.`;
  }

  if (symbol.includes("XAU")) {
    return `This metal chart loads ${label} candle history first, then keeps the view fresh with live price updates so you can track reaction speed, trend pressure, and indicator context in one place.`;
  }

  if (/STEP/i.test(symbol) || /step index/i.test(label)) {
    return `This step index chart loads Deriv candle history first, then stays updated with live ticks so you can monitor ladder-like movement, timing, and indicator alignment without losing your place.`;
  }

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /volatility/i.test(label)) {
    return `This synthetic index chart loads Deriv candle history first, then stays fresh with live ticks so you can follow volatility, structure, and indicator overlays without staring at an empty panel.`;
  }

  return `This market chart loads ${label} candle history first, then keeps the view fresh with live price updates so you can follow structure, trend, and indicator context without waiting on an empty panel.`;
}

export function DerivMarketChart({ symbol, label, onQuoteUpdate }: DerivMarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const shouldFitContentRef = useRef(true);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAMES[0]);
  const [barSpacing, setBarSpacing] = useState(9);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);
  const [candles, setCandles] = useState<CandlestickData<Time>[]>([]);
  const [fallbackPoints, setFallbackPoints] = useState<MarketHistoryPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
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
          secondsVisible: false,
          rightOffset: 6,
          barSpacing,
          minBarSpacing: 0.35,
          rightBarStaysOnScroll: true,
          shiftVisibleRangeOnNewBar: true
        },
        crosshair: {
          vertLine: { color: "rgba(87,212,168,0.28)" },
          horzLine: { color: "rgba(87,212,168,0.18)" }
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: {
            time: true,
            price: true
          }
        }
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#57d4a8",
        downColor: "#f97373",
        borderVisible: false,
        wickUpColor: "#57d4a8",
        wickDownColor: "#f97373",
        priceLineVisible: true,
        lastValueVisible: true
      });

      const smaSeries = chart.addLineSeries({
        color: "#fbbf24",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      });
      const emaSeries = chart.addLineSeries({
        color: "#60a5fa",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false
      });
      const bollingerUpper = chart.addLineSeries({
        color: "rgba(196, 181, 253, 0.9)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false
      });
      const bollingerMiddle = chart.addLineSeries({
        color: "rgba(167, 139, 250, 0.75)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false
      });
      const bollingerLower = chart.addLineSeries({
        color: "rgba(196, 181, 253, 0.9)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      smaSeriesRef.current = smaSeries;
      emaSeriesRef.current = emaSeries;
      bollingerUpperRef.current = bollingerUpper;
      bollingerMiddleRef.current = bollingerMiddle;
      bollingerLowerRef.current = bollingerLower;
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
        candleSeriesRef.current = null;
        smaSeriesRef.current = null;
        emaSeriesRef.current = null;
        bollingerUpperRef.current = null;
        bollingerMiddleRef.current = null;
        bollingerLowerRef.current = null;
        setChartReady(false);
      };
    } catch {
      setChartError(true);
      setChartReady(false);
      return;
    }
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        barSpacing
      }
    });
  }, [barSpacing]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      crosshair: {
        vertLine: {
          visible: crosshairEnabled,
          labelVisible: crosshairEnabled,
          color: crosshairEnabled ? "rgba(87,212,168,0.28)" : "rgba(0,0,0,0)"
        },
        horzLine: {
          visible: crosshairEnabled,
          labelVisible: crosshairEnabled,
          color: crosshairEnabled ? "rgba(87,212,168,0.18)" : "rgba(0,0,0,0)"
        }
      }
    });
  }, [crosshairEnabled]);

  useEffect(() => {
    let active = true;
    let quoteSocket: WebSocket | null = null;
    shouldFitContentRef.current = true;

    const applyCandleResponse = (response: MarketCandleResponse) => {
      const nextCandles = toChartCandles(response.candles);
      setCandles(nextCandles);
      setFallbackPoints(response.candles.map((candle) => ({ time: candle.time, value: candle.close })));
      setStatus(response.source === "live" ? "live" : "fallback");
      setLastUpdatedAt(response.updatedAt);
    };

    const loadCandles = async () => {
      setIsRefreshing(true);

      try {
        const response = await apiRequest<MarketCandleResponse>(
          `/api/v1/deriv/market-candles?symbol=${encodeURIComponent(symbol)}&count=${timeframe.count}&granularity=${timeframe.granularity}`
        );

        if (!active) {
          return;
        }

        applyCandleResponse(response);
      } catch {
        if (!active) {
          return;
        }

        try {
          const response = await fetchDirectDerivCandles(symbol, timeframe.granularity, timeframe.count);
          if (!active) {
            return;
          }

          applyCandleResponse(response);
        } catch {
          if (!active) {
            return;
          }

          setStatus((current) => (current === "live" ? current : "fallback"));
        }
      } finally {
        if (active) {
          setIsRefreshing(false);
        }
      }
    };

    if (candles.length === 0) {
      setStatus("loading");
      setLastUpdatedAt("");
    }

    void loadCandles();

    try {
      quoteSocket = new window.WebSocket(`${DERIV_PUBLIC_WS_URL}?app_id=${DERIV_PUBLIC_APP_ID}`);
      quoteSocket.onopen = () => {
        quoteSocket?.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      };

      quoteSocket.onmessage = (event) => {
        if (!active) {
          return;
        }

        try {
          const message = JSON.parse(String(event.data)) as DerivTickMessage;
          const quote = message.tick?.quote;
          const epoch = message.tick?.epoch;
          const pipSize = message.tick?.pip_size ?? 2;

          if (message.msg_type !== "tick" || typeof quote !== "number") {
            return;
          }

          const point = {
            time: Math.floor(epoch ?? Date.now() / 1000),
            value: quote
          } satisfies MarketHistoryPoint;

          const spread = inferSpread(symbol, pipSize);
          const ask = quote + spread / 2;
          const bid = quote - spread / 2;

          setStatus("live");
          setLastUpdatedAt(new Date(point.time * 1000).toISOString());
          setCandles((current) => upsertTickIntoCandles(current, point, timeframe.granularity, timeframe.count));
          setFallbackPoints((current) => [...current.slice(-239), point]);

          onQuoteUpdate?.({
            ask: ask.toFixed(Math.max(pipSize, 2)),
            bid: bid.toFixed(Math.max(pipSize, 2)),
            mid: quote.toFixed(Math.max(pipSize, 2)),
            updatedAt: new Date(point.time * 1000).toISOString(),
            source: "live"
          });
        } catch {
          // Ignore quote stream parse errors and keep the chart session alive.
        }
      };

      quoteSocket.onerror = () => {
        if (!active) {
          return;
        }

        setStatus((current) => (current === "live" ? current : "fallback"));
      };
    } catch {
      setStatus((current) => (current === "live" ? current : "fallback"));
    }

    return () => {
      active = false;
      quoteSocket?.close();
    };
  }, [symbol, timeframe, onQuoteUpdate]);

  useEffect(() => {
    if (!candleSeriesRef.current) {
      return;
    }

    candleSeriesRef.current.setData(candles);
    if (candles.length > 0 && shouldFitContentRef.current) {
      const timeScale = chartRef.current?.timeScale();
      if (!timeScale) {
        return;
      }

      if (candles.length < 8) {
        timeScale.setVisibleLogicalRange({
          from: -2,
          to: Math.max(candles.length + 3, 10)
        });
      } else {
        timeScale.fitContent();
      }

      shouldFitContentRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    const smaSeries = smaSeriesRef.current;
    const emaSeries = emaSeriesRef.current;
    const bollingerUpper = bollingerUpperRef.current;
    const bollingerMiddle = bollingerMiddleRef.current;
    const bollingerLower = bollingerLowerRef.current;

    if (!smaSeries || !emaSeries || !bollingerUpper || !bollingerMiddle || !bollingerLower) {
      return;
    }

    smaSeries.setData(indicators.sma20 ? computeSma(candles, 20) : []);
    emaSeries.setData(indicators.ema21 ? computeEma(candles, 21) : []);

    if (indicators.bb20) {
      const bands = computeBollingerBands(candles, 20, 2);
      bollingerUpper.setData(bands.upper);
      bollingerMiddle.setData(bands.middle);
      bollingerLower.setData(bands.lower);
    } else {
      bollingerUpper.setData([]);
      bollingerMiddle.setData([]);
      bollingerLower.setData([]);
    }
  }, [candles, indicators]);

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

  const chartDescription = useMemo(() => getChartDescription(symbol, label), [symbol, label]);
  const canZoomOut = barSpacing > 3;
  const canZoomIn = barSpacing < 24;
  const sparklinePath = useMemo(() => buildSparklinePath(fallbackPoints, 900, 360), [fallbackPoints]);
  const activeIndicatorCount = useMemo(() => Object.values(indicators).filter(Boolean).length, [indicators]);

  const zoomChart = (direction: "in" | "out") => {
    setBarSpacing((current) => {
      const next = direction === "in" ? current * 1.2 : current / 1.2;
      return Math.min(24, Math.max(3, Number(next.toFixed(2))));
    });
  };

  const toggleIndicator = (indicator: IndicatorKey) => {
    setIndicators((current) => ({
      ...current,
      [indicator]: !current[indicator]
    }));
  };

  const autoFitChart = () => {
    chartRef.current?.timeScale().fitContent();
  };

  const resetChartView = () => {
    setBarSpacing(9);
    setCrosshairEnabled(true);
    setIndicators(DEFAULT_INDICATORS);
    window.setTimeout(() => {
      chartRef.current?.timeScale().fitContent();
    }, 0);
  };

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
            {chartDescription}
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
            {status === "live" ? "Live Deriv feed" : status === "loading" ? "Loading Deriv candles" : "Indicative fallback"}
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

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIndicatorPanel((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-secondary text-xs transition ${
              showIndicatorPanel
                ? "bg-accent text-slate-950"
                : "border border-border/70 bg-card/70 text-slate-300 hover:border-accent/30 hover:text-white"
            }`}
            aria-expanded={showIndicatorPanel}
            aria-pressed={showIndicatorPanel}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Indicators {activeIndicatorCount > 0 ? `(${activeIndicatorCount})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setCrosshairEnabled((current) => !current)}
            className={`rounded-full px-3 py-1 font-secondary text-xs transition ${
              crosshairEnabled
                ? "bg-card text-white"
                : "border border-border/70 bg-card/70 text-slate-300 hover:border-accent/30 hover:text-white"
            }`}
            aria-pressed={crosshairEnabled}
          >
            {crosshairEnabled ? "Crosshair on" : "Crosshair off"}
          </button>
          <button
            type="button"
            onClick={autoFitChart}
            className="rounded-full border border-border/70 bg-card/70 px-3 py-1 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white"
          >
            Auto-fit
          </button>
          <button
            type="button"
            onClick={resetChartView}
            className="rounded-full border border-border/70 bg-card/70 px-3 py-1 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white"
          >
            Reset view
          </button>
        </div>
      </div>

      {showIndicatorPanel ? (
        <div className="mb-4 rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Indicator settings</p>
              <p className="descriptive-copy mt-2 max-w-2xl text-xs text-slate-400">
                Turn overlays on or off depending on whether you want trend context, momentum smoothing, or volatility bands.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIndicators(DEFAULT_INDICATORS)}
              className="self-start rounded-full border border-border/70 bg-card/70 px-3 py-1 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white"
            >
              Reset indicators
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleIndicator("sma20")}
              className={`rounded-full px-3 py-1 font-secondary text-xs transition ${
                indicators.sma20
                  ? "bg-amber-300 text-slate-950"
                  : "border border-border/70 bg-card/70 text-slate-300 hover:border-amber-300/40 hover:text-white"
              }`}
              aria-pressed={indicators.sma20}
            >
              SMA 20
            </button>
            <button
              type="button"
              onClick={() => toggleIndicator("ema21")}
              className={`rounded-full px-3 py-1 font-secondary text-xs transition ${
                indicators.ema21
                  ? "bg-sky-300 text-slate-950"
                  : "border border-border/70 bg-card/70 text-slate-300 hover:border-sky-300/40 hover:text-white"
              }`}
              aria-pressed={indicators.ema21}
            >
              EMA 21
            </button>
            <button
              type="button"
              onClick={() => toggleIndicator("bb20")}
              className={`rounded-full px-3 py-1 font-secondary text-xs transition ${
                indicators.bb20
                  ? "bg-violet-300 text-slate-950"
                  : "border border-border/70 bg-card/70 text-slate-300 hover:border-violet-300/40 hover:text-white"
              }`}
              aria-pressed={indicators.bb20}
            >
              Bollinger 20
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-slate-950/35 p-3">
              <p className="text-sm font-medium text-white">SMA 20</p>
              <p className="descriptive-copy mt-2 text-xs text-slate-400">Smooths recent price action to help you read the broader direction.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-slate-950/35 p-3">
              <p className="text-sm font-medium text-white">EMA 21</p>
              <p className="descriptive-copy mt-2 text-xs text-slate-400">Reacts faster to current movement when you want a more responsive trend line.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-slate-950/35 p-3">
              <p className="text-sm font-medium text-white">Bollinger 20</p>
              <p className="descriptive-copy mt-2 text-xs text-slate-400">Shows expanding or contracting price bands so volatility is easier to read visually.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="descriptive-copy inline-flex items-center gap-2 text-xs text-slate-300">
            <MoveHorizontal className="h-3.5 w-3.5 text-accent" />
            Drag to pan
          </div>
          <div className="descriptive-copy text-xs text-slate-400">Use the mouse wheel or pinch gesture to scale smoothly without resetting your view.</div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => zoomChart("out")}
            disabled={!canZoomOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/70 text-slate-200 transition hover:border-accent/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom out chart"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomChart("in")}
            disabled={!canZoomIn}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/70 text-slate-200 transition hover:border-accent/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom in chart"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
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
              <p className="descriptive-copy text-xs text-slate-400">Loading candle history for {label} on the selected timeframe.</p>
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
