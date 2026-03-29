import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { registerRoutes } from "./routes/index.js";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    })
  ]);
}

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: [env.CLIENT_URL],
    credentials: true
  });

  await app.register(sensible);
  await app.register(jwt, {
    secret: env.JWT_SECRET
  });
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute"
  });

  await registerRoutes(app);

  const io = new SocketIOServer(app.server, {
    cors: {
      origin: [env.CLIENT_URL],
      credentials: true
    }
  });

  let subscriber: ReturnType<typeof redis.duplicate> | null = null;

  try {
    await withTimeout(redis.ping(), 1200, "Redis ping");
    subscriber = redis.duplicate();
    subscriber.on("error", () => {
      app.log.warn("Socket.io Redis subscriber connection failed");
    });
    io.adapter(createAdapter(redis, subscriber));
  } catch (error) {
    app.log.warn({ error }, "Redis unavailable, using default in-memory socket adapter");
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const payload = await app.jwt.verify<{
        id: string;
        email: string;
        role: string;
        subscriptionTier: string;
      }>(token);

      socket.data.user = payload;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string };
    socket.join(`user:${user.id}`);

    socket.emit("system:notice", {
      title: "Risk disclosure",
      body: "Past performance is not indicative of future results. Automated execution can magnify losses."
    });
  });

  app.decorate("io", io);

  app.addHook("onClose", async () => {
    await prisma.$disconnect().catch(() => undefined);
    if (subscriber) {
      await subscriber.quit().catch(() => undefined);
    }
    if (redis.status !== "end") {
      await redis.quit().catch(() => undefined);
    }
  });

  return app;
}