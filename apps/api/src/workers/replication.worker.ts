import { Worker } from "bullmq";
import { redis } from "../lib/redis.js";
import { executeReplicationJob } from "../modules/copy-trading/copy.service.js";

export const replicationWorker = new Worker(
  "copy-replication",
  async (job) => {
    await executeReplicationJob(job.data);
  },
  {
    connection: redis,
    concurrency: 10
  }
);
