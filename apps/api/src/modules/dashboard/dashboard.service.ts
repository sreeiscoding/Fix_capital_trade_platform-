import { prisma } from "../../lib/prisma.js";
import { listAiSignals } from "../analytics/analytics.service.js";
import { calculatePerformance, listMasters } from "../copy-trading/copy.service.js";

export async function getDashboardSnapshot(userId: string) {
  const [accounts, recentTrades, performance, bots, masters, signals] = await Promise.all([
    prisma.derivAccount.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.tradeAudit.findMany({
      where: {
        OR: [{ masterId: userId }, { copierId: userId }]
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    calculatePerformance(userId),
    prisma.botConfig.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    }),
    listMasters(),
    listAiSignals(userId)
  ]);

  const equity = accounts.reduce((sum, account) => sum + Number(account.equityCached), 0);
  const balance = accounts.reduce((sum, account) => sum + Number(account.balanceCached), 0);

  return {
    stats: {
      balance,
      equity,
      linkedAccounts: accounts.length,
      activeBots: bots.filter((bot) => bot.status === "RUNNING").length,
      openCopyTrades: recentTrades.filter((trade) => ["OPEN", "FILLED"].includes(trade.status)).length
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      loginId: account.loginId,
      environment: account.environment,
      currency: account.currency,
      balance: account.balanceCached,
      equity: account.equityCached
    })),
    recentTrades,
    performance,
    bots,
    leaderboard: masters,
    signals
  };
}
