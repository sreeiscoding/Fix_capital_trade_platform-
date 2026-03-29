import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureAuth } from "../auth/auth.routes.js";
import {
  calculatePerformance,
  ingestMasterSignal,
  listCopyRelationships,
  listMasters,
  upsertCopyRelationship
} from "./copy.service.js";

export async function copyTradingRoutes(app: FastifyInstance) {
  app.get("/masters", async () => {
    return { masters: await listMasters() };
  });

  app.get("/relationships", { preHandler: [ensureAuth(app)] }, async (request) => {
    return {
      relationships: await listCopyRelationships(request.authUser!.id)
    };
  });

  app.post("/subscribe", { preHandler: [ensureAuth(app)] }, async (request) => {
    const body = z
      .object({
        masterId: z.string(),
        masterAccountId: z.string(),
        copierAccountId: z.string(),
        allocationPct: z.number().min(1).max(100),
        lotMultiplier: z.number().min(0.1).max(10),
        maxDrawdownPct: z.number().min(1).max(100),
        maxOpenPositions: z.number().int().min(1).max(20),
        stopLossPct: z.number().min(1).max(100).optional()
      })
      .parse(request.body);

    const relationship = await upsertCopyRelationship({
      masterId: body.masterId,
      copierId: request.authUser!.id,
      masterAccountId: body.masterAccountId,
      copierAccountId: body.copierAccountId,
      allocationPct: body.allocationPct,
      lotMultiplier: body.lotMultiplier,
      maxDrawdownPct: body.maxDrawdownPct,
      maxOpenPositions: body.maxOpenPositions,
      stopLossPct: body.stopLossPct
    });

    return { relationship };
  });

  app.post("/signals/manual", { preHandler: [ensureAuth(app)] }, async (request) => {
    const body = z
      .object({
        symbol: z.string(),
        contractType: z.string(),
        duration: z.number().int().positive(),
        durationUnit: z.string(),
        amount: z.number().positive(),
        basis: z.enum(["stake", "payout"]),
        barrier: z.string().optional()
      })
      .parse(request.body);

    await ingestMasterSignal({
      masterId: request.authUser!.id,
      masterTradeRef: `manual_${Date.now()}`,
      ...body,
      rawPayload: body
    });

    return { ok: true };
  });

  app.get("/performance", { preHandler: [ensureAuth(app)] }, async (request) => {
    return {
      performance: await calculatePerformance(request.authUser!.id)
    };
  });
}
