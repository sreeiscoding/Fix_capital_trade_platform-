import { CopyRelationshipStatus } from "@prisma/client";
import { Queue } from "bullmq";
import { getDecryptedDerivToken } from "../deriv/deriv-oauth.service.js";
import { withDerivConnection } from "../../lib/deriv-client.js";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";

export const copyQueue = new Queue("copy-replication", {
  connection: redis
});

type NormalizedTradeSignal = {
  masterId: string;
  masterTradeRef: string;
  symbol: string;
  contractType: string;
  duration: number;
  durationUnit: string;
  amount: number;
  basis: "stake" | "payout";
  barrier?: string;
  rawPayload: Record<string, unknown>;
};

export async function listMasters() {
  const leaderboardKey = "leaderboard:masters";
  const cached = await redis.zrevrange(leaderboardKey, 0, 9, "WITHSCORES");

  if (cached.length > 0) {
    const results = [] as Array<Record<string, unknown>>;
    for (let index = 0; index < cached.length; index += 2) {
      const userId = cached[index];
      const score = cached[index + 1];
      const profile = await prisma.masterProfile.findUnique({
        where: { userId },
        include: {
          user: {
            include: {
              derivAccounts: {
                orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                take: 1
              }
            }
          }
        }
      });

      if (profile) {
        const primaryAccount = profile.user.derivAccounts[0];
        results.push({
          userId,
          displayName: profile.displayName,
          score: Number(score),
          winRate: profile.winRate,
          profitFactor: profile.profitFactor,
          maxDrawdown: profile.maxDrawdown,
          monthlyReturn: profile.monthlyReturn,
          followers: profile.totalFollowers,
          primaryAccountId: primaryAccount?.id ?? null,
          primaryAccountLoginId: primaryAccount?.loginId ?? null
        });
      }
    }

    return results;
  }

  const masters = await prisma.masterProfile.findMany({
    include: {
      user: {
        include: {
          derivAccounts: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            take: 1
          }
        }
      }
    },
    orderBy: [{ monthlyReturn: "desc" }, { winRate: "desc" }]
  });

  if (masters.length > 0) {
    const pipeline = redis.multi();
    masters.forEach((master) => {
      pipeline.zadd(leaderboardKey, master.monthlyReturn, master.userId);
    });
    pipeline.expire(leaderboardKey, 300);
    await pipeline.exec();
  }

  return masters.map((master) => ({
    userId: master.userId,
    displayName: master.displayName,
    score: master.monthlyReturn,
    winRate: master.winRate,
    profitFactor: master.profitFactor,
    maxDrawdown: master.maxDrawdown,
    monthlyReturn: master.monthlyReturn,
    followers: master.totalFollowers,
    primaryAccountId: master.user.derivAccounts[0]?.id ?? null,
    primaryAccountLoginId: master.user.derivAccounts[0]?.loginId ?? null
  }));
}

export async function upsertCopyRelationship(input: {
  masterId: string;
  copierId: string;
  masterAccountId: string;
  copierAccountId: string;
  allocationPct: number;
  lotMultiplier: number;
  maxDrawdownPct: number;
  maxOpenPositions: number;
  stopLossPct?: number;
}) {
  const relationKey = {
    masterId: input.masterId,
    copierId: input.copierId,
    masterAccountId: input.masterAccountId,
    copierAccountId: input.copierAccountId
  };

  const existing = await prisma.copyRelationship.findUnique({
    where: {
      masterId_copierId_masterAccountId_copierAccountId: relationKey
    }
  });

  const relationship = await prisma.copyRelationship.upsert({
    where: {
      masterId_copierId_masterAccountId_copierAccountId: relationKey
    },
    create: {
      ...input,
      status: CopyRelationshipStatus.ACTIVE
    },
    update: {
      allocationPct: input.allocationPct,
      lotMultiplier: input.lotMultiplier,
      maxDrawdownPct: input.maxDrawdownPct,
      maxOpenPositions: input.maxOpenPositions,
      stopLossPct: input.stopLossPct,
      status: CopyRelationshipStatus.ACTIVE
    }
  });

  if (!existing) {
    await prisma.masterProfile.update({
      where: { userId: input.masterId },
      data: {
        totalFollowers: {
          increment: 1
        }
      }
    }).catch(() => undefined);
  }

  return relationship;
}

export async function listCopyRelationships(userId: string) {
  return prisma.copyRelationship.findMany({
    where: {
      OR: [{ masterId: userId }, { copierId: userId }]
    },
    include: {
      master: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      copier: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      masterAccount: true,
      copierAccount: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function ingestMasterSignal(signal: NormalizedTradeSignal) {
  await prisma.tradeSignal.create({
    data: {
      masterId: signal.masterId,
      symbol: signal.symbol,
      contractType: signal.contractType,
      duration: signal.duration,
      durationUnit: signal.durationUnit,
      amount: signal.amount,
      basis: signal.basis,
      barrier: signal.barrier,
      source: "COPY",
      rawPayload: signal.rawPayload
    }
  });

  const followers = await prisma.copyRelationship.findMany({
    where: {
      masterId: signal.masterId,
      status: CopyRelationshipStatus.ACTIVE
    },
    include: {
      copier: true,
      copierAccount: true
    }
  });

  await Promise.all(
    followers.map((relationship) =>
      copyQueue.add("replicate-trade", {
        relationshipId: relationship.id,
        signal
      })
    )
  );
}

export async function executeReplicationJob(payload: {
  relationshipId: string;
  signal: NormalizedTradeSignal;
}) {
  const relationship = await prisma.copyRelationship.findUnique({
    where: { id: payload.relationshipId },
    include: {
      copier: true,
      copierAccount: true
    }
  });

  if (!relationship || relationship.status !== CopyRelationshipStatus.ACTIVE) {
    return;
  }

  const { accessToken } = await getDecryptedDerivToken(relationship.copierAccountId);

  await withDerivConnection(accessToken, async ({ basic }) => {
    const balanceResponse = await basic.balance({ balance: 1 });
    const currentBalance = Number(balanceResponse?.balance?.balance ?? 0);
    const maxRiskAmount = currentBalance * (relationship.allocationPct / 100);
    const requestedAmount = Math.min(
      payload.signal.amount * relationship.lotMultiplier,
      maxRiskAmount
    );

    if (requestedAmount <= 0) {
      await logSkippedTrade(relationship.id, payload.signal, "Computed risk amount was zero");
      return;
    }

    const openTrades = await prisma.tradeAudit.count({
      where: {
        copyRelationshipId: relationship.id,
        status: {
          in: ["OPEN", "FILLED"]
        }
      }
    });

    if (openTrades >= relationship.maxOpenPositions) {
      await logSkippedTrade(relationship.id, payload.signal, "Max open positions reached");
      return;
    }

    const proposal = await basic.proposal({
      proposal: 1,
      amount: requestedAmount,
      basis: payload.signal.basis,
      contract_type: payload.signal.contractType,
      currency: relationship.copierAccount.currency ?? "USD",
      duration: payload.signal.duration,
      duration_unit: payload.signal.durationUnit,
      symbol: payload.signal.symbol,
      barrier: payload.signal.barrier
    });

    const proposalId = proposal?.proposal?.id;

    if (!proposalId) {
      await logSkippedTrade(relationship.id, payload.signal, "Proposal did not return an id");
      return;
    }

    const buyResult = await basic.buy({
      buy: proposalId,
      price: requestedAmount
    });

    await prisma.tradeAudit.create({
      data: {
        copyRelationshipId: relationship.id,
        masterId: payload.signal.masterId,
        copierId: relationship.copierId,
        masterTradeRef: payload.signal.masterTradeRef,
        copierTradeRef: String(
          buyResult?.buy?.contract_id ?? buyResult?.buy?.transaction_id ?? "pending"
        ),
        symbol: payload.signal.symbol,
        amount: requestedAmount,
        status: "FILLED",
        source: "COPY",
        rawMasterPayload: payload.signal.rawPayload,
        rawCopierPayload: buyResult
      }
    });
  });
}

async function logSkippedTrade(
  relationshipId: string,
  signal: NormalizedTradeSignal,
  reason: string
) {
  await prisma.tradeAudit.create({
    data: {
      copyRelationshipId: relationshipId,
      masterId: signal.masterId,
      symbol: signal.symbol,
      amount: signal.amount,
      status: "SKIPPED",
      source: "COPY",
      rawMasterPayload: {
        ...signal.rawPayload,
        skipReason: reason
      }
    }
  });
}

export async function calculatePerformance(userId: string) {
  const [totalTrades, profitableTrades, profits] = await Promise.all([
    prisma.tradeAudit.count({
      where: {
        OR: [{ masterId: userId }, { copierId: userId }]
      }
    }),
    prisma.tradeAudit.count({
      where: {
        OR: [{ masterId: userId }, { copierId: userId }],
        profit: {
          gt: 0
        }
      }
    }),
    prisma.tradeAudit.aggregate({
      where: {
        OR: [{ masterId: userId }, { copierId: userId }]
      },
      _sum: {
        profit: true
      },
      _avg: {
        profit: true
      }
    })
  ]);

  return {
    totalTrades,
    winRate: totalTrades === 0 ? 0 : profitableTrades / totalTrades,
    cumulativeProfit: profits._sum.profit ?? 0,
    averageProfit: profits._avg.profit ?? 0
  };
}
