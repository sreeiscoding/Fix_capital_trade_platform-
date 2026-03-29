import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  wantsToBeMaster?: boolean;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.wantsToBeMaster ? "MASTER" : "USER",
      masterProfile: input.wantsToBeMaster
        ? {
            create: {
              displayName: input.name,
              bio: "Verified performance pending",
              strategyTag: "Discretionary"
            }
          }
        : undefined
    }
  });

  return sanitizeUser(user);
}

export async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return sanitizeUser(user);
}

export async function seedDemoUser() {
  const demoEmail = "demo@astrotrade.app";
  const existing = await prisma.user.findUnique({
    where: { email: demoEmail }
  });

  if (existing) {
    return;
  }

  await registerUser({
    email: demoEmail,
    password: "DemoPass123!",
    name: "Astro Demo Master",
    wantsToBeMaster: true
  });
}

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  role: "USER" | "MASTER" | "ADMIN";
  subscriptionTier: "FREE" | "PRO" | "VIP";
  kycStatus: "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    kycStatus: user.kycStatus
  };
}
