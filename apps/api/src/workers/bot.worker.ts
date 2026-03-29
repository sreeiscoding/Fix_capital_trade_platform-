import { Worker } from "bullmq";
import { redis } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";

export const botWorker = new Worker(
  "bot-execution",
  async (job) => {
    const bot = await prisma.botConfig.findUnique({
      where: { id: job.data.botId }
    });

    if (!bot || bot.status !== "RUNNING") {
      return;
    }

    await prisma.botConfig.update({
      where: { id: bot.id },
      data: {
        lastHeartbeatAt: new Date()
      }
    });
  },
  {
    connection: redis,
    concurrency: 5
  }
);
