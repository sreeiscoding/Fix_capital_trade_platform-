import IORedis from "ioredis";
import { env } from "../config/env.js";

const globalForRedis = globalThis as unknown as {
  redis?: IORedis;
};

export const redis =
  globalForRedis.redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  });

redis.on("error", () => {
  // Redis is optional in local degraded mode. Runtime checks decide whether to use it.
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}