import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { seedDemoUser } from "./modules/auth/auth.service.js";
import { syncMasterTradeMonitors, stopMasterTradeMonitors } from "./modules/copy-trading/master-monitor.service.js";
import { botWorker } from "./workers/bot.worker.js";
import { replicationWorker } from "./workers/replication.worker.js";

async function start() {
  const app = await buildApp();
  await seedDemoUser();
  await syncMasterTradeMonitors().catch((error) => {
    app.log.warn({ error }, "Master monitors did not start cleanly");
  });

  const interval = setInterval(() => {
    void syncMasterTradeMonitors().catch((error) => {
      app.log.warn({ error }, "Master monitor sync failed");
    });
  }, 60000);

  replicationWorker.on("failed", (job, error) => {
    app.log.error({ jobId: job?.id, error }, "Copy replication job failed");
  });

  botWorker.on("failed", (job, error) => {
    app.log.error({ jobId: job?.id, error }, "Bot job failed");
  });

  app.addHook("onClose", async () => {
    clearInterval(interval);
    await stopMasterTradeMonitors();
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
