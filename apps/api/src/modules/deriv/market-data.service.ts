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

type DerivHistoryMessage = {
  msg_type?: string;
  history?: {
    prices?: Array<number | string>;
    times?: number[];
  };
  error?: {
    message?: string;
  };
};

type DerivActiveSymbol = {
  symbol?: string;
  display_name?: string;
  pip?: number | string;
};

type DerivActiveSymbolsMessage = {
  msg_type?: string;
  active_symbols?: DerivActiveSymbol[];
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
  source: "live" | "fallback";
};

export type MarketQuoteFeed = {
  source: "live" | "mixed" | "fallback";
  quotes: MarketQuoteSnapshot[];
};

export type MarketHistoryPoint = {
  time: number;
  value: number;
};

export type MarketHistoryFeed = {
  source: "live" | "fallback";
  points: MarketHistoryPoint[];
};

const DEFAULT_MARKETS: readonly MarketQuoteConfig[] = [
  { symbol: "frxEURUSD", label: "EUR/USD", fallbackMid: 1.08418, decimals: 5 },
  { symbol: "frxXAUUSD", label: "XAU/USD", fallbackMid: 3068.16, decimals: 2 },
  { symbol: "frxGBPJPY", label: "GBP/JPY", fallbackMid: 198.348, decimals: 3 },
  { symbol: "R_100", label: "R_100", fallbackMid: 5123.48, decimals: 2 }
] as const;


const OFFICIAL_VOLATILITY_MARKETS: readonly MarketQuoteConfig[] = [
  { symbol: "R_10", label: "Volatility 10 Index", fallbackMid: 5917.06, decimals: 3 },
  { symbol: "R_25", label: "Volatility 25 Index", fallbackMid: 2780.19, decimals: 3 },
  { symbol: "R_50", label: "Volatility 50 Index", fallbackMid: 127.8, decimals: 4 },
  { symbol: "R_75", label: "Volatility 75 Index", fallbackMid: 67683.31, decimals: 4 },
  { symbol: "R_100", label: "R_100", fallbackMid: 5123.48, decimals: 2 },
  { symbol: "1HZ10V", label: "Volatility 10 (1s) Index", fallbackMid: 9315.4, decimals: 4 },
  { symbol: "1HZ25V", label: "Volatility 25 (1s) Index", fallbackMid: 646097.29, decimals: 4 },
  { symbol: "1HZ50V", label: "Volatility 50 (1s) Index", fallbackMid: 211091.77, decimals: 4 },
  { symbol: "1HZ75V", label: "Volatility 75 (1s) Index", fallbackMid: 4006.97, decimals: 4 },
  { symbol: "1HZ90V", label: "Volatility 90 (1s) Index", fallbackMid: 22372.47, decimals: 4 },
  { symbol: "1HZ100V", label: "Volatility 100 (1s) Index", fallbackMid: 773.78, decimals: 4 }
] as const;
const EXPANDED_SYNTHETIC_PATTERNS = [
  /^Volatility 10 Index$/i,
  /^Volatility 25 Index$/i,
  /^Volatility 50 Index$/i,
  /^Volatility 75 Index$/i,
  /^Volatility 100 Index$/i,
  /^Step Index/i
] as const;

const LIVE_CACHE_TTL_MS = 1500;
const HISTORY_CACHE_TTL_MS = 4000;
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000;

let quoteCache:
  | {
      expiresAt: number;
      data: MarketQuoteFeed;
    }
  | null = null;

let watchlistCache:
  | {
      expiresAt: number;
      markets: MarketQuoteConfig[];
    }
  | null = null;

const historyCache = new Map<
  string,
  {
    expiresAt: number;
    data: MarketHistoryFeed;
  }
>();

function formatWithPrecision(value: number, decimals: number) {
  return value.toFixed(Math.max(decimals, 2));
}

function inferSpread(symbol: string, pipSize: number) {
  const pipUnit = 10 ** -pipSize;

  if (symbol.startsWith("R_") || /HZ\d+V$/i.test(symbol) || /STEP/i.test(symbol)) {
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

function findMarket(symbol: string) {
  return DEFAULT_MARKETS.find((market) => market.symbol === symbol) ?? DEFAULT_MARKETS[0];
}

function inferFallbackMid(symbol: string) {
  const seed = hashSymbol(symbol);
  return Number((100 + (seed % 9000) / 10).toFixed(2));
}

function inferDecimalsFromPip(pip: number | string | undefined, symbol: string) {
  if (typeof pip === "number" && Number.isFinite(pip)) {
    const pipString = pip.toString();
    const [, decimals = ""] = pipString.split(".");
    return Math.max(decimals.length, 2);
  }

  if (typeof pip === "string" && pip.includes(".")) {
    return Math.max(pip.split(".")[1]?.length ?? 0, 2);
  }

  if (symbol.startsWith("frx")) {
    return 5;
  }

  return 2;
}

function buildFallbackQuote(market: MarketQuoteConfig, now = Date.now()): MarketQuoteSnapshot {
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
    updatedAt: new Date(now).toISOString(),
    source: "fallback"
  };
}

function buildFallbackQuotes(markets = DEFAULT_MARKETS) {
  const now = Date.now();
  return markets.map((market) => buildFallbackQuote(market, now));
}

function buildFallbackHistory(symbol: string, count: number) {
  const market = findMarket(symbol);
  const now = Date.now();
  const seed = hashSymbol(symbol);

  return Array.from({ length: count }, (_, index) => {
    const timestamp = now - (count - index - 1) * 60_000;
    const wave = Math.sin(timestamp / 210_000 + seed / 7) * Math.max(market.fallbackMid * 0.00016, 0.02);
    const drift = Math.cos(timestamp / 340_000 + seed / 11) * Math.max(market.fallbackMid * 0.00008, 0.01);
    const pulse = Math.sin(index / 4 + seed / 19) * Math.max(market.fallbackMid * 0.00004, 0.006);

    return {
      time: Math.floor(timestamp / 1000),
      value: Number((market.fallbackMid + wave + drift + pulse).toFixed(market.decimals))
    };
  });
}

async function fetchDerivTicks(markets: readonly MarketQuoteConfig[]) {
  return await new Promise<Map<string, MarketQuoteSnapshot>>((resolve, reject) => {
    const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
    const quotes = new Map<string, MarketQuoteSnapshot>();
    let settled = false;

    const settle = (value?: Map<string, MarketQuoteSnapshot>, error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(value ?? new Map<string, MarketQuoteSnapshot>());
    };

    const timeout = setTimeout(() => {
      if (quotes.size > 0) {
        settle(new Map(quotes));
        return;
      }

      settle(undefined, new Error("Timed out while fetching live market quotes"));
    }, 4500);

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
          if (quotes.size > 0) {
            settle(new Map(quotes));
            return;
          }

          settle(undefined, new Error(message.error.message ?? "Failed to fetch live market quotes"));
          return;
        }

        if (message.msg_type !== "tick" || !message.tick?.symbol || typeof message.tick.quote !== "number") {
          return;
        }

        const tick = message.tick;
        const quote = tick.quote as number;
        const market = markets.find((entry) => entry.symbol === tick.symbol);
        if (!market) {
          return;
        }

        const pipSize = tick.pip_size ?? market.decimals;
        const spread = inferSpread(market.symbol, pipSize);
        const ask = quote + spread / 2;
        const bid = quote - spread / 2;
        const decimals = Math.max(pipSize, 2);

        quotes.set(market.symbol, {
          symbol: market.symbol,
          label: market.label,
          ask: formatWithPrecision(ask, decimals),
          bid: formatWithPrecision(bid, decimals),
          mid: formatWithPrecision(quote, decimals),
          updatedAt: new Date((tick.epoch ?? Date.now() / 1000) * 1000).toISOString(),
          source: "live"
        });

        if (quotes.size === markets.length) {
          settle(new Map(quotes));
        }
      } catch (error) {
        if (quotes.size > 0) {
          settle(new Map(quotes));
          return;
        }

        settle(undefined, error instanceof Error ? error : new Error("Failed to parse live market quote payload"));
      }
    });

    connection.on("error", (error) => {
      if (quotes.size > 0) {
        settle(new Map(quotes));
        return;
      }

      settle(undefined, error instanceof Error ? error : new Error("Live market quote connection failed"));
    });

    connection.on("close", () => {
      if (!settled && quotes.size > 0) {
        settle(new Map(quotes));
      }
    });
  });
}

async function fetchDerivTickHistory(symbol: string, count: number) {
  return await new Promise<MarketHistoryPoint[]>((resolve, reject) => {
    const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
    let settled = false;

    const settle = (points?: MarketHistoryPoint[], error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(points ?? []);
    };

    const timeout = setTimeout(() => {
      settle(undefined, new Error("Timed out while fetching market history"));
    }, 7000);

    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeAllListeners();
      if (connection.readyState === WebSocket.OPEN || connection.readyState === WebSocket.CONNECTING) {
        connection.close();
      }
    };

    connection.on("open", () => {
      connection.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          end: "latest",
          count,
          style: "ticks"
        })
      );
    });

    connection.on("message", (payload) => {
      try {
        const message = JSON.parse(String(payload)) as DerivHistoryMessage;

        if (message.error) {
          settle(undefined, new Error(message.error.message ?? "Failed to fetch market history"));
          return;
        }

        if (message.msg_type !== "history" || !message.history?.prices || !message.history.times) {
          return;
        }

        const points = message.history.times
          .map((time, index) => {
            const rawPrice = message.history?.prices?.[index];
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

        settle(points);
      } catch (error) {
        settle(undefined, error instanceof Error ? error : new Error("Failed to parse market history payload"));
      }
    });

    connection.on("error", (error) => {
      settle(undefined, error instanceof Error ? error : new Error("Market history connection failed"));
    });
  });
}

async function fetchDerivActiveSymbols() {
  return await new Promise<DerivActiveSymbol[]>((resolve, reject) => {
    const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
    let settled = false;

    const settle = (symbols?: DerivActiveSymbol[], error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(symbols ?? []);
    };

    const timeout = setTimeout(() => {
      settle(undefined, new Error("Timed out while fetching active symbols"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeAllListeners();
      if (connection.readyState === WebSocket.OPEN || connection.readyState === WebSocket.CONNECTING) {
        connection.close();
      }
    };

    connection.on("open", () => {
      connection.send(JSON.stringify({ active_symbols: "brief", product_type: "basic" }));
    });

    connection.on("message", (payload) => {
      try {
        const message = JSON.parse(String(payload)) as DerivActiveSymbolsMessage;

        if (message.error) {
          settle(undefined, new Error(message.error.message ?? "Failed to fetch active symbols"));
          return;
        }

        if (message.msg_type !== "active_symbols" || !message.active_symbols) {
          return;
        }

        settle(message.active_symbols);
      } catch (error) {
        settle(undefined, error instanceof Error ? error : new Error("Failed to parse active symbols payload"));
      }
    });

    connection.on("error", (error) => {
      settle(undefined, error instanceof Error ? error : new Error("Active symbols connection failed"));
    });
  });
}

function buildFeedFromMarkets(markets: readonly MarketQuoteConfig[], liveQuotes: Map<string, MarketQuoteSnapshot>) {
  const now = Date.now();
  const quotes = markets.map((market) => liveQuotes.get(market.symbol) ?? buildFallbackQuote(market, now));
  const liveCount = quotes.filter((quote) => quote.source === "live").length;

  return {
    source: liveCount === 0 ? "fallback" : liveCount === quotes.length ? "live" : "mixed",
    quotes
  } satisfies MarketQuoteFeed;
}

function matchSyntheticCandidates(symbols: DerivActiveSymbol[]) {
  const picked = new Map<string, MarketQuoteConfig>();

  for (const pattern of EXPANDED_SYNTHETIC_PATTERNS) {
    const match = symbols.find((item) => pattern.test(item.display_name ?? ""));
    if (!match?.symbol || !match.display_name || picked.has(match.symbol)) {
      continue;
    }

    picked.set(match.symbol, {
      symbol: match.symbol,
      label: match.display_name,
      fallbackMid: inferFallbackMid(match.symbol),
      decimals: inferDecimalsFromPip(match.pip, match.symbol)
    });
  }

  return [...picked.values()];
}

async function getExpandedWatchlistMarkets() {
  if (watchlistCache && watchlistCache.expiresAt > Date.now()) {
    return watchlistCache.markets;
  }

  try {
    const activeSymbols = await fetchDerivActiveSymbols();
    const syntheticMarkets = matchSyntheticCandidates(activeSymbols);
    const defaultSymbols = new Set(DEFAULT_MARKETS.map((market) => market.symbol));
    const seededSymbols = new Set([...DEFAULT_MARKETS, ...OFFICIAL_VOLATILITY_MARKETS].map((market) => market.symbol));
    const markets = [
      ...DEFAULT_MARKETS,
      ...OFFICIAL_VOLATILITY_MARKETS.filter((market) => !defaultSymbols.has(market.symbol)),
      ...syntheticMarkets.filter((market) => !seededSymbols.has(market.symbol))
    ];

    watchlistCache = {
      markets,
      expiresAt: Date.now() + WATCHLIST_CACHE_TTL_MS
    };

    return markets;
  } catch {
    return [...DEFAULT_MARKETS];
  }
}

export async function getLiveMarketQuotes(): Promise<MarketQuoteFeed> {
  if (quoteCache && quoteCache.expiresAt > Date.now()) {
    return quoteCache.data;
  }

  try {
    const liveQuotes = await fetchDerivTicks(DEFAULT_MARKETS);
    const data = buildFeedFromMarkets(DEFAULT_MARKETS, liveQuotes);

    quoteCache = {
      data,
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS
    };
    return data;
  } catch {
    return {
      source: "fallback",
      quotes: buildFallbackQuotes()
    };
  }
}

export async function getExpandedMarketWatchlist(): Promise<MarketQuoteFeed> {
  const markets = await getExpandedWatchlistMarkets();

  try {
    const liveQuotes = await fetchDerivTicks(markets);
    return buildFeedFromMarkets(markets, liveQuotes);
  } catch {
    return {
      source: "fallback",
      quotes: buildFallbackQuotes(markets)
    };
  }
}

export async function getMarketHistory(symbol: string, count = 120): Promise<MarketHistoryFeed> {
  const cacheKey = `${symbol}:${count}`;
  const cached = historyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const points = await fetchDerivTickHistory(symbol, count);
    const data: MarketHistoryFeed = {
      source: "live",
      points
    };

    historyCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + HISTORY_CACHE_TTL_MS
    });

    return data;
  } catch {
    const data: MarketHistoryFeed = {
      source: "fallback",
      points: buildFallbackHistory(symbol, count)
    };

    historyCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + HISTORY_CACHE_TTL_MS
    });

    return data;
  }
}
