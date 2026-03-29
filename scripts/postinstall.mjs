import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(
  npmCommand,
  ["run", "prisma:generate", "--workspace", "@astrotrade/api"],
  {
    stdio: "inherit",
    shell: false,
    env: process.env
  }
);

if (result.status !== 0) {
  console.warn("\n[astrotrade] Prisma client generation was skipped during postinstall.");
  console.warn("[astrotrade] This commonly happens when engine downloads are blocked or offline.");
  console.warn("[astrotrade] Run `npm run prisma:generate` later once network access is available.\n");
}
