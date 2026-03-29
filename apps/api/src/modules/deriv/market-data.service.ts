import WebSocket from "ws";
import { env } from "../../config/env.js";

type MarketQuoteConfig = {
  symbol: string;
  label: string;
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

const DEFAULT_MARKETS: readonly MarketQuoteConfig[] = [
  { symbol: "frxEURUSD", label: "EUR/USD" },
  { symbol: "frxXAUUSD", label: "XAU/USD" },
  { symbol: "frxGBPJPY", label: "GBP/JPY" },
  { symbol: "R_100", label: "R_100" }
] as const;

const CACHE_TTL_MS = 15000;

let cache:
  | {
      expiresAt: number;
      data: MarketQuoteSnapshot[];
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

async function fetchDerivTicks(markets: readonly MarketQuoteConfig[]) {
  return await new Promise<MarketQuoteSnapshot[]>((resolve, reject) => {
    const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
    const quotes = new Map<string, MarketQuoteSnapshot>();
    const timeout = setTimeout(() => {
      connection.close();
      if (quotes.size > 0) {
        resolve(markets.flatMap((market) => {
          const quote = quotes.get(market.symbol);
          return quote ? [quote] : [];
        }));
        return;
      }
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

        const pipSize = message.tick.pip_size ?? 2;
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

export async function getLiveMarketQuotes() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const data = await fetchDerivTicks(DEFAULT_MARKETS);
  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return data;
}