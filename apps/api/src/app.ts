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

  const subscriber = redis.duplicate();
  io.adapter(createAdapter(redis, subscriber));

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
    await prisma.$disconnect();
    await subscriber.quit();
    await redis.quit();
  });

  return app;
}
