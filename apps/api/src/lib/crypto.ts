import crypto from "node:crypto";
import { env } from "../config/env.js";

const algorithm = "aes-256-gcm";
const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string) {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format");
  }

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export function randomToken(length = 48) {
  return crypto.randomBytes(length).toString("base64url");
}

export async function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}
