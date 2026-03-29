import { BotStatus, type Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";

let botQueue: Queue | null = null;

function getBotQueue() {
  botQueue ??= new Queue("bot-execution", {
    connection: redis
  });

  return botQueue;
}

const strategyTemplates = [
  {
    key: "rsi-crossover",
    name: "RSI Crossover",
    description: "Buys when RSI crosses above 30 and exits into mean reversion.",
    config: {
      symbol: "R_100",
      entry: [{ indicator: "RSI", operator: "crosses_above", value: 30 }],
      exit: [{ indicator: "RSI", operator: "crosses_above", value: 60 }],
      risk: { martingale: false, riskPerTradePct: 1.5 }
    }
  },
  {
    key: "martingale-digits",
    name: "Digits Martingale",
    description: "Illustrative template for demo environments only.",
    config: {
      symbol: "R_75",
      entry: [{ indicator: "LAST_DIGIT", operator: "equals", value: 7 }],
      exit: [{ indicator: "PnL", operator: "gte", value: 2 }],
      risk: { martingale: true, multiplier: 1.6, riskPerTradePct: 0.5 }
    }
  }
];

export function getBotTemplates() {
  return strategyTemplates;
}

export async function listBots(userId: string) {
  return prisma.botConfig.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function saveBot(userId: string, input: {
  id?: string;
  name: string;
  templateKey?: string;
  symbol: string;
  riskPerTradePct: number;
  config: Record<string, unknown>;
}) {
  const config = input.config as Prisma.InputJsonValue;

  if (input.id) {
    const existing = await prisma.botConfig.findFirst({
      where: { id: input.id, userId }
    });

    if (!existing) {
      throw new Error("Bot not found");
    }

    return prisma.botConfig.update({
      where: { id: input.id },
      data: {
        name: input.name,
        templateKey: input.templateKey,
        symbol: input.symbol,
        riskPerTradePct: input.riskPerTradePct,
        config
      }
    });
  }

  return prisma.botConfig.create({
    data: {
      userId,
      name: input.name,
      templateKey: input.templateKey,
      symbol: input.symbol,
      riskPerTradePct: input.riskPerTradePct,
      config
    }
  });
}

export async function updateBotStatus(userId: string, botId: string, status: BotStatus) {
  const existing = await prisma.botConfig.findFirst({
    where: { id: botId, userId }
  });

  if (!existing) {
    throw new Error("Bot not found");
  }

  const bot = await prisma.botConfig.update({
    where: { id: botId },
    data: {
      status,
      lastHeartbeatAt: status === BotStatus.RUNNING ? new Date() : null
    }
  });

  if (status === BotStatus.RUNNING) {
    await getBotQueue().add("run-bot", {
      botId
    });
  }

  return bot;
}