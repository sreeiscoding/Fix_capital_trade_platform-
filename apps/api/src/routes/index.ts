import type { FastifyInstance } from "fastify";
import { analyticsRoutes } from "../modules/analytics/analytics.routes.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { billingRoutes } from "../modules/billing/billing.routes.js";
import { botRoutes } from "../modules/bots/bot.routes.js";
import { copyTradingRoutes } from "../modules/copy-trading/copy.routes.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { derivRoutes } from "../modules/deriv/deriv.routes.js";
import { getRuntimeDependencies } from "../lib/runtime-state.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "astrotrade-api",
    timestamp: new Date().toISOString(),
    dependencies: getRuntimeDependencies()
  }));

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(derivRoutes, { prefix: "/api/v1/deriv" });
  await app.register(copyTradingRoutes, { prefix: "/api/v1/copy-trading" });
  await app.register(botRoutes, { prefix: "/api/v1/bots" });
  await app.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  await app.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  await app.register(billingRoutes, { prefix: "/api/v1/billing" });
}
