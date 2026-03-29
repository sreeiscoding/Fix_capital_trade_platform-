import { createSubscribedDerivClient } from "../../lib/deriv-client.js";
import { prisma } from "../../lib/prisma.js";
import { getDecryptedDerivToken } from "../deriv/deriv-oauth.service.js";
import { ingestMasterSignal } from "./copy.service.js";

const streamRegistry = new Map<string, { close: () => void }>();

function normalizeTransaction(masterId: string, transaction: Record<string, any>) {
  const action = transaction.action_type ?? transaction.transaction_type ?? transaction.action;
  const symbol = transaction.symbol;

  if (!symbol || !String(action).toLowerCase().includes("buy")) {
    return null;
  }

  return {
    masterId,
    masterTradeRef: String(
      transaction.contract_id ?? transaction.transaction_id ?? transaction.id ?? `stream_${Date.now()}`
    ),
    symbol: String(symbol),
    contractType: String(transaction.contract_type ?? transaction.contractType ?? "CALL"),
    duration: Number(transaction.duration ?? 5),
    durationUnit: String(transaction.duration_unit ?? transaction.durationUnit ?? "m"),
    amount: Number(transaction.amount ?? transaction.purchase_price ?? 1),
    basis: String(transaction.basis ?? "stake") === "payout" ? "payout" : "stake",
    barrier: transaction.barrier ? String(transaction.barrier) : undefined,
    rawPayload: transaction
  } as const;
}

async function startMonitor(masterAccountId: string) {
  const relationship = await prisma.copyRelationship.findFirst({
    where: { masterAccountId },
    include: { master: true }
  });

  if (!relationship) {
    return;
  }

  const { accessToken } = await getDecryptedDerivToken(masterAccountId);
  const client = await createSubscribedDerivClient(accessToken);

  client.connection.on("message", async (raw) => {
    try {
      const payload = JSON.parse(raw.toString()) as Record<string, any>;
      const transaction = payload.transaction ?? (payload.msg_type === "transaction" ? payload : null);

      if (!transaction) {
        return;
      }

      const normalized = normalizeTransaction(relationship.masterId, transaction);
      if (normalized) {
        await ingestMasterSignal(normalized);
      }
    } catch (error) {
      console.error("Failed to process master transaction", error);
    }
  });

  client.connection.send(JSON.stringify({ transaction: 1, subscribe: 1 }));

  streamRegistry.set(masterAccountId, {
    close: () => client.connection.close()
  });
}

export async function syncMasterTradeMonitors() {
  const activeRelationships = await prisma.copyRelationship.findMany({
    where: { status: "ACTIVE" },
    select: { masterAccountId: true }
  });

  const activeIds = new Set(activeRelationships.map((item) => item.masterAccountId));

  for (const [accountId, monitor] of streamRegistry.entries()) {
    if (!activeIds.has(accountId)) {
      monitor.close();
      streamRegistry.delete(accountId);
    }
  }

  for (const accountId of activeIds) {
    if (!streamRegistry.has(accountId)) {
      await startMonitor(accountId).catch((error) => {
        console.error("Unable to start master monitor", accountId, error);
      });
    }
  }
}

export async function stopMasterTradeMonitors() {
  for (const [accountId, monitor] of streamRegistry.entries()) {
    monitor.close();
    streamRegistry.delete(accountId);
  }
}
