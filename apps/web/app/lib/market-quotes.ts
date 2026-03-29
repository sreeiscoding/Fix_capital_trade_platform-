export type MarketQuote = {
  symbol: string;
  label: string;
  ask: string;
  bid: string;
  mid: string;
  updatedAt: string;
};

export const fallbackMarketQuotes: MarketQuote[] = [
  { symbol: "frxEURUSD", label: "EUR/USD", ask: "1.08426", bid: "1.08411", mid: "1.08418", updatedAt: new Date(0).toISOString() },
  { symbol: "frxXAUUSD", label: "XAU/USD", ask: "3068.42", bid: "3067.91", mid: "3068.16", updatedAt: new Date(0).toISOString() },
  { symbol: "frxGBPJPY", label: "GBP/JPY", ask: "198.364", bid: "198.331", mid: "198.348", updatedAt: new Date(0).toISOString() },
  { symbol: "R_100", label: "R_100", ask: "5123.84", bid: "5123.12", mid: "5123.48", updatedAt: new Date(0).toISOString() }
];