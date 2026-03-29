import { SignalDirection } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

function simpleRsi(prices: number[], period = 14) {
  if (prices.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;
  for (let index = prices.length - period; index < prices.length; index += 1) {
    const diff = prices[index] - prices[index - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export async function listAiSignals(userId?: string) {
  const recentTicks = await prisma.tickSnapshot.findMany({
    where: {
      symbol: {
        in: ["frxEURUSD", "frxXAUUSD", "R_100"]
      }
    },
    orderBy: { epoch: "desc" },
    take: 60
  });

  const grouped = recentTicks.reduce<Record<string, number[]>>((acc, tick) => {
    acc[tick.symbol] ??= [];
    acc[tick.symbol].push(tick.price);
    return acc;
  }, {});

  const signals = Object.entries(grouped).map(([symbol, prices]) => {
    const ordered = [...prices].reverse();
    const rsi = simpleRsi(ordered);
    const movingAverage =
      ordered.reduce((sum, price) => sum + price, 0) / Math.max(ordered.length, 1);
    const last = ordered[ordered.length - 1] ?? movingAverage;
    const direction =
      rsi < 35 ? SignalDirection.LONG : rsi > 65 ? SignalDirection.SHORT : SignalDirection.NEUTRAL;
    const probability = direction === SignalDirection.NEUTRAL ? 0.52 : 0.67;

    return {
      symbol,
      timeframe: "5m",
      direction,
      probability,
      confidence: Math.min(0.92, Math.abs(last - movingAverage) + 0.58),
      rationale:
        direction === SignalDirection.LONG
          ? "Oversold momentum with mean-reversion bias."
          : direction === SignalDirection.SHORT
            ? "Overbought momentum with fading strength."
            : "No clear edge. Wait for confirmation.",
      indicators: {
        rsi,
        movingAverage,
        last
      }
    };
  });

  if (userId && signals.length > 0) {
    await prisma.signalSnapshot.createMany({
      data: signals.map((signal) => ({
        userId,
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        direction: signal.direction,
        probability: signal.probability,
        confidence: signal.confidence,
        rationale: signal.rationale,
        indicators: signal.indicators
      }))
    }).catch(() => undefined);
  }

  return signals;
}
