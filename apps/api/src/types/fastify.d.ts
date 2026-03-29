import type { SubscriptionTier, UserRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      role: UserRole;
      subscriptionTier: SubscriptionTier;
    };
  }

  interface FastifyInstance {
    io: any;
  }
}

export {};
