import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ensureAuth } from "../auth/auth.routes.js";

export async function billingRoutes(app: FastifyInstance) {
  app.get("/plans", async () => {
    return {
      plans: [
        {
          name: "Free",
          tier: "FREE",
          priceMonthly: 0,
          features: ["1 demo bot", "Public leaderboard", "Manual copy alerts"]
        },
        {
          name: "Pro",
          tier: "PRO",
          priceMonthly: 49,
          features: ["3 live bots", "Auto-copy execution", "AI analytics", "Priority signals"]
        },
        {
          name: "VIP",
          tier: "VIP",
          priceMonthly: 149,
          features: ["Unlimited bots", "Lower performance fee", "Private rooms", "White-glove support"]
        }
      ]
    };
  });

  app.post("/webhooks/stripe", async (request) => {
    const body = z
      .object({
        type: z.string(),
        data: z.object({
          object: z.record(z.any())
        })
      })
      .parse(request.body);

    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventType: body.type,
        payload: body
      }
    });

    return { received: true };
  });

  app.get("/subscription", { preHandler: [ensureAuth(app)] }, async (request) => {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: request.authUser!.id },
      orderBy: { createdAt: "desc" }
    });

    return {
      subscription
    };
  });
}
