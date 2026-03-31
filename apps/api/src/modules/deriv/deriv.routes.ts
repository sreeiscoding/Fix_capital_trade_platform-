import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ensureAuth } from "../auth/auth.routes.js";
import {
  completeDerivOAuthCallback,
  createDerivAuthorizationUrl,
  listDerivAccounts,
  unlinkDerivAccount
} from "./deriv-oauth.service.js";
import { getExpandedMarketWatchlist, getLiveMarketQuotes, getMarketCandles, getMarketHistory } from "./market-data.service.js";

export async function derivRoutes(app: FastifyInstance) {
  app.get("/market-quotes", async () => {
    return await getLiveMarketQuotes();
  });

  app.get("/market-watchlist", async () => {
    return await getExpandedMarketWatchlist();
  });

  app.get("/market-history", async (request) => {
    const query = z
      .object({
        symbol: z.string().min(1),
        count: z.coerce.number().int().min(20).max(300).default(120)
      })
      .parse(request.query);

    return await getMarketHistory(query.symbol, query.count);
  });

  app.get("/market-candles", async (request) => {
    const query = z
      .object({
        symbol: z.string().min(1),
        count: z.coerce.number().int().min(20).max(300).default(120),
        granularity: z.coerce.number().int().min(60).max(86400).default(60)
      })
      .parse(request.query);

    return await getMarketCandles(query.symbol, query.count, query.granularity);
  });

  app.get("/accounts", { preHandler: [ensureAuth(app)] }, async (request) => {
    return {
      accounts: await listDerivAccounts(request.authUser!.id)
    };
  });

  app.post("/oauth/start", { preHandler: [ensureAuth(app)] }, async (request) => {
    const body = z
      .object({
        environment: z.enum(["demo", "real"]).default("demo")
      })
      .parse(request.body ?? {});

    return {
      url: await createDerivAuthorizationUrl({
        userId: request.authUser!.id,
        environment: body.environment
      })
    };
  });

  app.get("/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string(),
        state: z.string()
      })
      .parse(request.query);

    try {
      await completeDerivOAuthCallback(query);
      const redirectUrl = new URL("/dashboard?deriv=connected", env.CLIENT_URL);
      return reply.redirect(redirectUrl.toString());
    } catch {
      const redirectUrl = new URL("/dashboard?deriv=error", env.CLIENT_URL);
      return reply.redirect(redirectUrl.toString());
    }
  });

  app.delete("/accounts/:accountId", { preHandler: [ensureAuth(app)] }, async (request) => {
    const params = z.object({ accountId: z.string() }).parse(request.params);
    await unlinkDerivAccount(request.authUser!.id, params.accountId);
    return { ok: true };
  });
}
