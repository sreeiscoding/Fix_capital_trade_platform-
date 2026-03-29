import WebSocket from "ws";
import { env } from "../../config/env.js";

type MarketQuoteConfig = {
  symbol: string;
  label: string;
  fallbackMid: number;
  decimals: number;
};

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

export type MarketQuoteSnapshot = {
  symbol: string;
  label: string;
  ask: string;
  bid: string;
  mid: string;
  updatedAt: string;
};

export type MarketQuoteFeed = {
  source: "live" | "fallback";
  quotes: MarketQuoteSnapshot[];
};

const DEFAULT_MARKETS: readonly MarketQuoteConfig[] = [
  { symbol: "frxEURUSD", label: "EUR/USD", fallbackMid: 1.08418, decimals: 5 },
  { symbol: "frxXAUUSD", label: "XAU/USD", fallbackMid: 3068.16, decimals: 2 },
  { symbol: "frxGBPJPY", label: "GBP/JPY", fallbackMid: 198.348, decimals: 3 },
  { symbol: "R_100", label: "R_100", fallbackMid: 5123.48, decimals: 2 }
] as const;

const LIVE_CACHE_TTL_MS = 1500;

let cache:
  | {
      expiresAt: number;
      data: MarketQuoteFeed;
    }
  | null = null;

function formatWithPrecision(value: number, decimals: number) {
  return value.toFixed(Math.max(decimals, 2));
}

function inferSpread(symbol: string, pipSize: number) {
  const pipUnit = 10 ** -pipSize;

  if (symbol.startsWith("R_")) {
    return pipUnit * 6;
  }

  if (symbol.includes("XAU")) {
    return pipUnit * 10;
  }

  return pipUnit * 4;
}

function hashSymbol(symbol: string) {
  return Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildFallbackQuotes() {
  const now = Date.now();

  return DEFAULT_MARKETS.map((market) => {
    const seed = hashSymbol(market.symbol);
    const wave = Math.sin(now / 2500 + seed) * Math.max(market.fallbackMid * 0.00018, 0.025);
    const drift = Math.cos(now / 4200 + seed / 5) * Math.max(market.fallbackMid * 0.00007, 0.012);
    const mid = market.fallbackMid + wave + drift;
    const spread = inferSpread(market.symbol, market.decimals);
    const ask = mid + spread / 2;
    const bid = mid - spread / 2;

    return {
      symbol: market.symbol,
      label: market.label,
      ask: formatWithPrecision(ask, market.decimals),
      bid: formatWithPrecision(bid, market.decimals),
      mid: formatWithPrecision(mid, market.decimals),
      updatedAt: new Date(now).toISOString()
    };
  });
}

async function fetchDerivTicks(markets: readonly MarketQuoteConfig[]) {
  return await new Promise<MarketQuoteSnapshot[]>((resolve, reject) => {
    const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
    const quotes = new Map<string, MarketQuoteSnapshot>();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while fetching live market quotes"));
    }, 7000);

    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeAllListeners();
      if (connection.readyState === WebSocket.OPEN || connection.readyState === WebSocket.CONNECTING) {
        connection.close();
      }
    };

    connection.on("open", () => {
      for (const market of markets) {
        connection.send(JSON.stringify({ ticks: market.symbol, subscribe: 1 }));
      }
    });

    connection.on("message", (payload) => {
      try {
        const message = JSON.parse(String(payload)) as DerivTickMessage;

        if (message.error) {
          cleanup();
          reject(new Error(message.error.message ?? "Failed to fetch live market quotes"));
          return;
        }

        if (message.msg_type !== "tick" || !message.tick?.symbol || typeof message.tick.quote !== "number") {
          return;
        }

        const market = markets.find((entry) => entry.symbol === message.tick?.symbol);
        if (!market) {
          return;
        }

        const pipSize = message.tick.pip_size ?? market.decimals;
        const spread = inferSpread(market.symbol, pipSize);
        const ask = message.tick.quote + spread / 2;
        const bid = message.tick.quote - spread / 2;
        const decimals = Math.max(pipSize, 2);

        quotes.set(market.symbol, {
          symbol: market.symbol,
          label: market.label,
          ask: formatWithPrecision(ask, decimals),
          bid: formatWithPrecision(bid, decimals),
          mid: formatWithPrecision(message.tick.quote, decimals),
          updatedAt: new Date((message.tick.epoch ?? Date.now() / 1000) * 1000).toISOString()
        });

        if (quotes.size === markets.length) {
          const ordered = markets.flatMap((entry) => {
            const quote = quotes.get(entry.symbol);
            return quote ? [quote] : [];
          });
          cleanup();
          resolve(ordered);
        }
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error("Failed to parse live market quote payload"));
      }
    });

    connection.on("error", (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Live market quote connection failed"));
    });
  });
}

export async function getLiveMarketQuotes(): Promise<MarketQuoteFeed> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  try {
    const quotes = await fetchDerivTicks(DEFAULT_MARKETS);
    const data: MarketQuoteFeed = {
      source: "live",
      quotes
    };
    cache = {
      data,
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS
    };
    return data;
  } catch (error) {
    return {
      source: "fallback",
      quotes: buildFallbackQuotes()
    };
  }
}
