import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env.local"),
  resolve(process.cwd(), "../../.env"),
  resolve(currentDir, "../../../.env.local"),
  resolve(currentDir, "../../../.env"),
  resolve(currentDir, "../../../../.env.local"),
  resolve(currentDir, "../../../../.env")
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  DERIV_APP_ID: z.string().min(1),
  DERIV_CLIENT_ID: z.string().min(1),
  DERIV_CLIENT_SECRET: z.string().min(1),
  DERIV_OAUTH_REDIRECT_URI: z.string().url(),
  DERIV_AUTH_BASE_URL: z.string().url().default("https://auth.deriv.com"),
  DERIV_WS_URL: z.string().url().default("wss://ws.derivws.com/websockets/v3"),
  DERIV_AFFILIATE_TOKEN: z.string().optional(),
  DERIV_UTM_CAMPAIGN: z.string().default("astrotrade"),
  DERIV_DEFAULT_SCOPE: z.string().default("openid trade payments admin"),
  DERIV_ENVIRONMENT: z.enum(["demo", "real"]).default("demo"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_VIP_PRICE_ID: z.string().optional()
});

export const env = envSchema.parse(process.env);