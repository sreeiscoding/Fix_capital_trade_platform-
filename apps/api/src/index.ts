import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { setDatabaseStatus, setRedisStatus } from "./lib/runtime-state.js";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    })
  ]);
}

async function start() {
  const app = await buildApp();

  const shutdownTasks: Array<() => Promise<void>> = [];

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500, "Database check");
    setDatabaseStatus("up");

    const [{ seedDemoUser }, { syncMasterTradeMonitors, stopMasterTradeMonitors }] = await Promise.all([
      import("./modules/auth/auth.service.js"),
      import("./modules/copy-trading/master-monitor.service.js")
    ]);

    await seedDemoUser().catch((error) => {
      app.log.warn({ error }, "Demo user seed skipped");
    });

    await syncMasterTradeMonitors().catch((error) => {
      app.log.warn({ error }, "Master monitors did not start cleanly");
    });

    const interval = setInterval(() => {
      void syncMasterTradeMonitors().catch((error) => {
        app.log.warn({ error }, "Master monitor sync failed");
      });
    }, 60000);

    shutdownTasks.push(async () => {
      clearInterval(interval);
      await stopMasterTradeMonitors();
    });
  } catch (error) {
    setDatabaseStatus("down");
    app.log.warn({ error }, "Database unavailable, starting API in degraded mode");
  }

  try {
    await withTimeout(redis.ping(), 1200, "Redis check");
    setRedisStatus("up");

    const [{ botWorker }, { replicationWorker }] = await Promise.all([
      import("./workers/bot.worker.js"),
      import("./workers/replication.worker.js")
    ]);

    replicationWorker.on("failed", (job, error) => {
      app.log.error({ jobId: job?.id, error }, "Copy replication job failed");
    });

    botWorker.on("failed", (job, error) => {
      app.log.error({ jobId: job?.id, error }, "Bot job failed");
    });
  } catch (error) {
    setRedisStatus("degraded");
    app.log.warn({ error }, "Redis unavailable, worker startup skipped");
  }

  app.addHook("onClose", async () => {
    for (const task of shutdownTasks) {
      await task().catch(() => undefined);
    }
  });

  await app.listen({
    host: "0.0.0.0",
    port: env.PORT
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
