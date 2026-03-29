import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BotStatus } from "@prisma/client";
import { ensureAuth } from "../auth/auth.routes.js";
import { getBotTemplates, listBots, saveBot, updateBotStatus } from "./bot.service.js";

export async function botRoutes(app: FastifyInstance) {
  app.get("/templates", async () => {
    return { templates: getBotTemplates() };
  });

  app.get("/", { preHandler: [ensureAuth(app)] }, async (request) => {
    return {
      bots: await listBots(request.authUser!.id)
    };
  });

  app.post("/", { preHandler: [ensureAuth(app)] }, async (request) => {
    const body = z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        templateKey: z.string().optional(),
        symbol: z.string(),
        riskPerTradePct: z.number().positive(),
        config: z.record(z.any())
      })
      .parse(request.body);

    return {
      bot: await saveBot(request.authUser!.id, body)
    };
  });

  app.post("/:botId/status", { preHandler: [ensureAuth(app)] }, async (request) => {
    const params = z.object({ botId: z.string() }).parse(request.params);
    const body = z
      .object({
        status: z.nativeEnum(BotStatus)
      })
      .parse(request.body);

    return {
      bot: await updateBotStatus(request.authUser!.id, params.botId, body.status)
    };
  });
}
