import type { FastifyInstance } from "fastify";
import { ensureAuth } from "../auth/auth.routes.js";
import { getDashboardSnapshot } from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [ensureAuth(app)] }, async (request) => {
    return getDashboardSnapshot(request.authUser!.id);
  });
}
