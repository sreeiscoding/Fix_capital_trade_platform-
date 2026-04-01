"use client";

import { Activity, ArrowRight, CandlestickChart, ChevronDown, ExternalLink, Minus, MoveHorizontal, PenTool, RefreshCw, Settings2, Slash, Square, Trash2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
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

type DrawingTool = "none" | "trendLine" | "ray" | "horizontalLine" | "rectangle" | "fibRetracement" | "noteLabel";

type DrawingAnchor = {
  time: number;
  price: number;
};

type ChartDrawing = {
  id: string;
  tool: Exclude<DrawingTool, "none">;
  anchors: DrawingAnchor[];
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
const DEFAULT_INDICATORS: IndicatorState = {
  sma20: true,
  ema21: false,
  bb20: false
};
const MAX_STORED_CANDLES = 6000;

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
function mergeCandles(older: CandlestickData<Time>[], newer: CandlestickData<Time>[]) {
  const merged = new Map<number, CandlestickData<Time>>();

  for (const candle of older) {
    merged.set(Number(candle.time), candle);
  }

  for (const candle of newer) {
    merged.set(Number(candle.time), candle);
  }

  return [...merged.values()].sort((left, right) => Number(left.time) - Number(right.time));
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
  maxCount: number
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

  return next.sort((left, right) => Number(left.time) - Number(right.time)).slice(-maxCount);
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
    return `This forex chart now opens with a deeper ${label} history from Deriv, then keeps extending with live price updates so the view feels closer to a real terminal chart.`;
  }

  if (symbol.includes("XAU")) {
    return `This metal chart now opens with a deeper ${label} history from Deriv, then keeps extending with live price updates so you can read trend pressure and volatility with fuller context.`;
  }

  if (/STEP/i.test(symbol) || /step index/i.test(label)) {
    return "This step index chart now opens with a deeper Deriv history and keeps extending with live ticks so you are not limited to a shallow snapshot.";
  }

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /volatility/i.test(label)) {
    return "This synthetic index chart now opens with a deeper Deriv history and keeps extending with live ticks so you are not limited to a shallow snapshot.";
  }

  return `This market chart now opens with a deeper ${label} history from Deriv, then keeps extending with live updates so the view feels closer to a real terminal chart.`;
}

function getInitialHistoryCount(granularity: number) {
  if (granularity <= 60) {
    return 1500;
  }

  if (granularity <= 300) {
    return 1200;
  }

  if (granularity <= 900) {
    return 900;
  }

  return 600;
}

function getBackfillCount(granularity: number) {
  if (granularity <= 60) {
    return 1000;
  }

  if (granularity <= 300) {
    return 800;
  }

  if (granularity <= 900) {
    return 600;
  }

  return 400;
}

function isTwoPointDrawingTool(tool: DrawingTool): tool is "trendLine" | "ray" | "rectangle" | "fibRetracement" {
  return tool === "trendLine" || tool === "ray" || tool === "rectangle" || tool === "fibRetracement";
}

function createDrawingId() {
  return `drawing_${Math.random().toString(36).slice(2, 10)}`;
}

function toEpochTime(value: Time | null | undefined) {
  return typeof value === "number" ? value : null;
}

async function fetchDirectDerivCandles(symbol: string, granularity: number, count: number, end: number | "latest" = "latest") {
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
      settle(undefined, new Error("Timed out while fetching Deriv candles"));
    }, 8000);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          end,
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
          settle(undefined, new Error(message.error.message ?? "Failed to fetch Deriv candles"));
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
        settle(undefined, error instanceof Error ? error : new Error("Failed to parse Deriv candle history"));
      }
    };

    socket.onerror = () => {
      settle(undefined, new Error("Direct Deriv candle connection failed"));
    };
  });
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
  const hasMoreHistoryRef = useRef(true);
  const isBackfillingRef = useRef(false);
  const earliestEpochRef = useRef<number | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAMES[0]);
  const [barSpacing, setBarSpacing] = useState(9);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);
  const [candles, setCandles] = useState<CandlestickData<Time>[]>([]);
  const [fallbackPoints, setFallbackPoints] = useState<MarketHistoryPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [pendingAnchor, setPendingAnchor] = useState<DrawingAnchor | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<DrawingAnchor | null>(null);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [showDrawingMenu, setShowDrawingMenu] = useState(false);
  const drawingMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDrawings([]);
    setDrawingTool("none");
    setPendingAnchor(null);
    setPreviewAnchor(null);
  }, [symbol]);

  useEffect(() => {
    if (!showDrawingMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!drawingMenuRef.current?.contains(event.target as Node)) {
        setShowDrawingMenu(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showDrawingMenu]);

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
          setViewportVersion((current) => current + 1);
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
    hasMoreHistoryRef.current = true;
    isBackfillingRef.current = false;
    earliestEpochRef.current = null;

    const applyCandleResponse = (response: MarketCandleResponse) => {
      const nextCandles = toChartCandles(response.candles);
      earliestEpochRef.current = nextCandles.length > 0 ? Number(nextCandles[0].time) : null;
      hasMoreHistoryRef.current = nextCandles.length > 0;
      setCandles(nextCandles);
      setFallbackPoints(response.candles.map((candle) => ({ time: candle.time, value: candle.close })));
      setStatus(response.source === "live" ? "live" : "fallback");
      setLastUpdatedAt(response.updatedAt);
    };

    const loadCandles = async () => {
      setIsRefreshing(true);
      const requestedCount = getInitialHistoryCount(timeframe.granularity);

      try {
        const response = await fetchDirectDerivCandles(symbol, timeframe.granularity, requestedCount);
        if (!active) {
          return;
        }

        applyCandleResponse(response);
      } catch {
        if (!active) {
          return;
        }

        setStatus((current) => (current === "live" ? current : "fallback"));
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
          setCandles((current) => upsertTickIntoCandles(current, point, timeframe.granularity, MAX_STORED_CANDLES));
          setFallbackPoints((current) => [...current.slice(-(MAX_STORED_CANDLES - 1)), point]);

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
    setViewportVersion((current) => current + 1);
    if (candles.length > 0 && shouldFitContentRef.current) {
      const timeScale = chartRef.current?.timeScale();
      if (!timeScale) {
        return;
      }

      const visibleBars = Math.min(Math.max(90, Math.floor(candles.length * 0.22)), 180);
      timeScale.setVisibleLogicalRange({
        from: Math.max(candles.length - visibleBars, 0),
        to: candles.length + 8
      });
      shouldFitContentRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const timeScale = chart.timeScale();
    const handleVisibleRangeChange = async (range: { from: number; to: number } | null) => {
      setViewportVersion((current) => current + 1);

      if (!range || range.from > 30 || isBackfillingRef.current || !hasMoreHistoryRef.current || earliestEpochRef.current === null) {
        return;
      }

      isBackfillingRef.current = true;
      setIsBackfilling(true);
      const previousRange = timeScale.getVisibleLogicalRange();

      try {
        const response = await fetchDirectDerivCandles(
          symbol,
          timeframe.granularity,
          getBackfillCount(timeframe.granularity),
          Math.max(earliestEpochRef.current - 1, 0)
        );

        if (response.candles.length === 0) {
          hasMoreHistoryRef.current = false;
          return;
        }

        const olderCandles = toChartCandles(response.candles);
        earliestEpochRef.current = Number(olderCandles[0]?.time ?? earliestEpochRef.current);

        let added = 0;
        setCandles((current) => {
          const merged = mergeCandles(olderCandles, current);
          added = Math.max(merged.length - current.length, 0);
          return merged;
        });
        setFallbackPoints((current) => {
          const merged = new Map<number, MarketHistoryPoint>();
          for (const point of response.candles.map((candle) => ({ time: candle.time, value: candle.close }))) {
            merged.set(point.time, point);
          }
          for (const point of current) {
            merged.set(point.time, point);
          }
          return [...merged.values()].sort((left, right) => left.time - right.time);
        });

        window.requestAnimationFrame(() => {
          const nextRange = timeScale.getVisibleLogicalRange() ?? previousRange;
          if (nextRange && added > 0) {
            timeScale.setVisibleLogicalRange({
              from: nextRange.from + added,
              to: nextRange.to + added
            });
          }
        });
      } catch {
        hasMoreHistoryRef.current = false;
      } finally {
        isBackfillingRef.current = false;
        setIsBackfilling(false);
      }
    };

    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [symbol, timeframe.granularity]);

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

  const drawingTools = [
    { key: "trendLine" as const, label: "Trend line", icon: Slash, group: "Core" },
    { key: "ray" as const, label: "Ray", icon: ArrowRight, group: "Core" },
    { key: "horizontalLine" as const, label: "Horizontal", icon: Minus, group: "Core" },
    { key: "rectangle" as const, label: "Rectangle", icon: Square, group: "Core" },
    { key: "fibRetracement" as const, label: "Fib retracement", icon: PenTool, group: "Advanced" },
    { key: "noteLabel" as const, label: "Note label", icon: Type, group: "Advanced" }
  ];

  const buildDrawingAnchor = (clientX: number, clientY: number) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const container = containerRef.current;

    if (!chart || !series || !container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = toEpochTime(chart.timeScale().coordinateToTime(x));
    const price = series.coordinateToPrice(y);

    if (time === null || price === null) {
      return null;
    }

    return { time, price } satisfies DrawingAnchor;
  };

  const clearPendingDrawing = () => {
    setPendingAnchor(null);
    setPreviewAnchor(null);
  };

  const handleSelectDrawingTool = (nextTool: DrawingTool) => {
    clearPendingDrawing();
    setDrawingTool((current) => (current === nextTool ? "none" : nextTool));
    setShowDrawingMenu(false);
  };

  const handleChartPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pendingAnchor || !isTwoPointDrawingTool(drawingTool)) {
      return;
    }

    const nextAnchor = buildDrawingAnchor(event.clientX, event.clientY);
    if (!nextAnchor) {
      return;
    }

    setPreviewAnchor(nextAnchor);
  };

  const handleChartClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (drawingTool === "none") {
      return;
    }

    const anchor = buildDrawingAnchor(event.clientX, event.clientY);
    if (!anchor) {
      return;
    }

    if (drawingTool === "horizontalLine" || drawingTool === "noteLabel") {
      setDrawings((current) => [...current, { id: createDrawingId(), tool: drawingTool, anchors: [anchor] }]);
      clearPendingDrawing();
      return;
    }

    if (!pendingAnchor) {
      setPendingAnchor(anchor);
      setPreviewAnchor(anchor);
      return;
    }

    setDrawings((current) => [...current, { id: createDrawingId(), tool: drawingTool, anchors: [pendingAnchor, anchor] }]);
    clearPendingDrawing();
  };

  const removeLastDrawing = () => {
    clearPendingDrawing();
    setDrawings((current) => current.slice(0, -1));
  };

  const clearAllDrawings = () => {
    clearPendingDrawing();
    setDrawings([]);
    setDrawingTool("none");
  };

  const drawingHint = drawingTool === "none"
    ? "Open the drawing menu to mark trend lines, levels, zones, Fibonacci retracements, and note labels on the chart."
    : pendingAnchor && isTwoPointDrawingTool(drawingTool)
      ? "Click a second point on the chart to finish this drawing."
      : drawingTool === "horizontalLine"
        ? "Click once on the chart to place a horizontal level."
        : drawingTool === "noteLabel"
          ? "Click once on the chart to place a note label."
          : "Click on the chart to begin drawing.";

  const overlayWidth = containerRef.current?.clientWidth ?? 0;
  const overlayHeight = containerRef.current?.clientHeight ?? 0;

  const drawingMarkup = useMemo(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;

    if (!chart || !series || overlayWidth === 0 || overlayHeight === 0) {
      return [] as React.ReactNode[];
    }

    const allDrawings = [...drawings];
    if (pendingAnchor && previewAnchor && isTwoPointDrawingTool(drawingTool)) {
      allDrawings.push({
        id: "preview",
        tool: drawingTool,
        anchors: [pendingAnchor, previewAnchor]
      });
    }

    const projectAnchor = (anchor: DrawingAnchor) => {
      const x = chart.timeScale().timeToCoordinate(anchor.time as Time);
      const y = series.priceToCoordinate(anchor.price);

      if (x === null || y === null) {
        return null;
      }

      return { x, y };
    };

    return allDrawings.flatMap((drawing) => {
      const isPreview = drawing.id === "preview";
      const stroke = drawing.tool === "rectangle" ? "#60a5fa" : drawing.tool === "horizontalLine" ? "#fbbf24" : "#57d4a8";
      const strokeDasharray = isPreview ? "6 4" : undefined;
      const opacity = isPreview ? 0.75 : 1;

      if (drawing.tool === "horizontalLine") {
        const point = projectAnchor(drawing.anchors[0]);
        if (!point) {
          return [];
        }

        return [
          <g key={drawing.id} opacity={opacity}>
            <line x1={0} y1={point.y} x2={overlayWidth} y2={point.y} stroke={stroke} strokeWidth={2} strokeDasharray={strokeDasharray} />
            <circle cx={point.x} cy={point.y} r={3.5} fill={stroke} />
          </g>
        ];
      }

      if (drawing.tool === "noteLabel") {
        const point = projectAnchor(drawing.anchors[0]);
        if (!point) {
          return [];
        }

        return [
          <g key={drawing.id} opacity={opacity}>
            <circle cx={point.x} cy={point.y} r={4} fill="#fbbf24" />
            <rect x={point.x + 8} y={point.y - 22} width={58} height={22} rx={11} fill="rgba(15, 23, 36, 0.94)" stroke="#fbbf24" strokeWidth={1.5} />
            <text x={point.x + 37} y={point.y - 8} fill="#f8fafc" fontSize="10" textAnchor="middle" fontFamily="var(--font-secondary), monospace">
              Note
            </text>
          </g>
        ];
      }

      const start = projectAnchor(drawing.anchors[0]);
      const end = projectAnchor(drawing.anchors[1]);
      if (!start || !end) {
        return [];
      }

      if (drawing.tool === "rectangle") {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        return [
          <g key={drawing.id} opacity={opacity}>
            <rect x={x} y={y} width={width} height={height} fill="rgba(96, 165, 250, 0.08)" stroke={stroke} strokeWidth={2} strokeDasharray={strokeDasharray} rx={6} />
          </g>
        ];
      }

      if (drawing.tool === "fibRetracement") {
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        const top = start.y;
        const bottom = end.y;
        const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

        return [
          <g key={drawing.id} opacity={opacity}>
            {ratios.map((ratio) => {
              const y = top + (bottom - top) * ratio;
              return (
                <g key={`${drawing.id}_${ratio}`}>
                  <line x1={left} y1={y} x2={right} y2={y} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray={strokeDasharray} />
                  <text x={right + 6} y={y + 3} fill="#c4b5fd" fontSize="10" fontFamily="var(--font-secondary), monospace">
                    {(ratio * 100).toFixed(ratio === 0 || ratio === 1 ? 0 : 1)}%
                  </text>
                </g>
              );
            })}
            <circle cx={start.x} cy={start.y} r={3.5} fill="#a78bfa" />
            <circle cx={end.x} cy={end.y} r={3.5} fill="#a78bfa" />
          </g>
        ];
      }

      if (drawing.tool === "ray") {
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const targetX = deltaX >= 0 ? overlayWidth : 0;
        const targetY = Math.abs(deltaX) < 0.5 ? end.y : start.y + (deltaY / deltaX) * (targetX - start.x);

        return [
          <g key={drawing.id} opacity={opacity}>
            <line x1={start.x} y1={start.y} x2={targetX} y2={targetY} stroke={stroke} strokeWidth={2} strokeDasharray={strokeDasharray} />
            <circle cx={start.x} cy={start.y} r={3.5} fill={stroke} />
            <circle cx={end.x} cy={end.y} r={3.5} fill={stroke} opacity={0.8} />
          </g>
        ];
      }

      return [
        <g key={drawing.id} opacity={opacity}>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={2} strokeDasharray={strokeDasharray} />
          <circle cx={start.x} cy={start.y} r={3.5} fill={stroke} />
          <circle cx={end.x} cy={end.y} r={3.5} fill={stroke} />
        </g>
      ];
    });
  }, [drawings, pendingAnchor, previewAnchor, drawingTool, overlayWidth, overlayHeight, viewportVersion]);

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

      <div className="mb-4 rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">Drawing tools</p>
            <p className="descriptive-copy mt-2 text-xs text-slate-400">{drawingHint}</p>
          </div>
          <div ref={drawingMenuRef} className="relative self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setShowDrawingMenu((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white"
              aria-expanded={showDrawingMenu}
              aria-pressed={showDrawingMenu}
            >
              <PenTool className="h-3.5 w-3.5" />
              Drawings {drawings.length > 0 ? `(${drawings.length})` : ""}
              <ChevronDown className={`h-3.5 w-3.5 transition ${showDrawingMenu ? "rotate-180" : "rotate-0"}`} />
            </button>

            {showDrawingMenu ? (
              <div className="absolute right-0 z-20 mt-3 w-[min(90vw,22rem)] rounded-3xl border border-border/70 bg-[#0f1724] p-4 shadow-2xl">
                <div className="space-y-4">
                  {(["Core", "Advanced"] as const).map((group) => {
                    const groupTools = drawingTools.filter((tool) => tool.group === group);
                    return (
                      <div key={group}>
                        <p className="descriptive-copy text-[11px] uppercase tracking-[0.18em] text-slate-500">{group} tools</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {group === "Core" ? (
                            <button
                              type="button"
                              onClick={() => handleSelectDrawingTool("none")}
                              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-secondary text-xs transition ${
                                drawingTool === "none"
                                  ? "bg-accent text-slate-950"
                                  : "border border-border/70 bg-card/70 text-slate-300 hover:border-accent/30 hover:text-white"
                              }`}
                              aria-pressed={drawingTool === "none"}
                            >
                              <PenTool className="h-3.5 w-3.5" />
                              Cursor
                            </button>
                          ) : null}
                          {groupTools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                              <button
                                key={tool.key}
                                type="button"
                                onClick={() => handleSelectDrawingTool(tool.key)}
                                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-secondary text-xs transition ${
                                  drawingTool === tool.key
                                    ? "bg-accent text-slate-950"
                                    : "border border-border/70 bg-card/70 text-slate-300 hover:border-accent/30 hover:text-white"
                                }`}
                                aria-pressed={drawingTool === tool.key}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {tool.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={removeLastDrawing}
                    disabled={drawings.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo last
                  </button>
                  <button
                    type="button"
                    onClick={clearAllDrawings}
                    disabled={drawings.length === 0 && !pendingAnchor}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2 font-secondary text-xs text-slate-300 transition hover:border-accent/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
          <div className="descriptive-copy text-xs text-slate-400">Use the mouse wheel or pinch gesture to scale smoothly. Pan left and the chart will pull in older Deriv history.</div>
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

        {!chartError && chartReady ? (
          <svg
            viewBox={`0 0 ${Math.max(overlayWidth, 1)} ${Math.max(overlayHeight, 1)}`}
            className={`absolute inset-0 z-10 h-full w-full ${drawingTool === "none" ? "pointer-events-none" : "pointer-events-auto cursor-crosshair"}`}
            preserveAspectRatio="none"
            onMouseMove={handleChartPointerMove}
            onClick={handleChartClick}
            aria-label="Chart drawing overlay"
          >
            <rect x={0} y={0} width={Math.max(overlayWidth, 1)} height={Math.max(overlayHeight, 1)} fill="transparent" />
            {drawingMarkup}
          </svg>
        ) : null}

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
              <p className="descriptive-copy text-xs text-slate-400">Loading deeper Deriv candle history for {label} and preparing the live stream.</p>
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
