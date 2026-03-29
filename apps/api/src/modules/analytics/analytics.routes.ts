import type { FastifyInstance } from "fastify";
import { ensureAuth } from "../auth/auth.routes.js";
import { listAiSignals } from "./analytics.service.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/signals", { preHandler: [ensureAuth(app)] }, async (request) => {
    return {
      signals: await listAiSignals(request.authUser!.id)
    };
  });
}
