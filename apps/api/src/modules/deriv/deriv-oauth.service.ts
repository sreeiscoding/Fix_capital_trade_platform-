import { DerivEnvironment } from "@prisma/client";
import { env } from "../../config/env.js";
import { createPkcePair, decryptSecret, encryptSecret, randomToken } from "../../lib/crypto.js";
import { withDerivConnection } from "../../lib/deriv-client.js";
import { prisma } from "../../lib/prisma.js";
import { sanitizeUser, type AuthUser } from "../auth/auth.service.js";

const PLACEHOLDER_EMAIL_DOMAIN = "auth.fixcapital.local";
const DERIV_IDENTITY_EMAIL_DOMAIN = "deriv.fixcapital.local";
const DERIV_SIGNUP_BASE_URL = "https://signup.deriv.com/signup";

type DerivOauthEnvironment = "demo" | "real";

type DerivOAuthCompletion = {
  derivAccount: Awaited<ReturnType<typeof prisma.derivAccount.upsert>>;
  user: AuthUser;
  isPlatformAuth: boolean;
};

function buildPendingEmail(state: string) {
  return `pending_${state}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function buildDerivIdentityEmail(loginId: string) {
  return `${loginId.toLowerCase()}@${DERIV_IDENTITY_EMAIL_DOMAIN}`;
}

function buildDerivDisplayName(loginId: string) {
  return `FixCapital Trader ${loginId}`;
}

function isPlaceholderUserEmail(email: string) {
  return email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

function hasConfiguredAffiliateToken() {
  const token = env.DERIV_AFFILIATE_TOKEN?.trim();

  if (!token) {
    return false;
  }

  const normalized = token.toLowerCase();
  return !normalized.includes("affiliate-token") && !normalized.includes("replace") && !normalized.includes("example");
}

async function createPlaceholderPlatformUser(state: string) {
  return await prisma.user.create({
    data: {
      email: buildPendingEmail(state),
      passwordHash: "oauth_managed",
      name: "Pending Deriv User"
    }
  });
}

async function resolvePlatformUserForOauthStart(userId: string | undefined, state: string) {
  if (userId) {
    return userId;
  }

  const placeholder = await createPlaceholderPlatformUser(state);
  return placeholder.id;
}

export async function createDerivAuthorizationUrl(input: {
  userId?: string;
  environment: DerivOauthEnvironment;
  scope?: string;
}) {
  const { verifier, challenge } = await createPkcePair();
  const state = randomToken(24);
  const scope = input.scope ?? env.DERIV_DEFAULT_SCOPE;
  const userId = await resolvePlatformUserForOauthStart(input.userId, state);

  await prisma.oAuthState.create({
    data: {
      userId,
      state,
      codeVerifier: verifier,
      requestedScope: scope,
      environment: input.environment === "real" ? DerivEnvironment.REAL : DerivEnvironment.DEMO,
      redirectUri: env.DERIV_OAUTH_REDIRECT_URI,
      affiliateToken: env.DERIV_AFFILIATE_TOKEN,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    }
  });

  const url = new URL("/oauth2/auth", env.DERIV_AUTH_BASE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.DERIV_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.DERIV_OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (hasConfiguredAffiliateToken()) {
    url.searchParams.set("affiliate_token", env.DERIV_AFFILIATE_TOKEN!.trim());
    url.searchParams.set("utm_campaign", env.DERIV_UTM_CAMPAIGN);
  }

  return url.toString();
}

export function createDerivSignupUrl() {
  const url = new URL(DERIV_SIGNUP_BASE_URL);

  if (hasConfiguredAffiliateToken()) {
    url.searchParams.set("t", env.DERIV_AFFILIATE_TOKEN!.trim());
  }

  if (env.DERIV_UTM_CAMPAIGN) {
    url.searchParams.set("utm_campaign", env.DERIV_UTM_CAMPAIGN);
  }

  return url.toString();
}

export async function completeDerivOAuthCallback(input: {
  code: string;
  state: string;
}): Promise<DerivOAuthCompletion> {
  const oauthState = await prisma.oAuthState.findUnique({
    where: { state: input.state },
    include: {
      user: true
    }
  });

  if (!oauthState || oauthState.expiresAt < new Date()) {
    throw new Error("OAuth state expired or invalid");
  }

  const tokenResponse = await fetch(new URL("/oauth2/token", env.DERIV_AUTH_BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.DERIV_CLIENT_ID,
      client_secret: env.DERIV_CLIENT_SECRET,
      code: input.code,
      code_verifier: oauthState.codeVerifier,
      redirect_uri: env.DERIV_OAUTH_REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    const failure = await tokenResponse.text();
    throw new Error(`Deriv token exchange failed: ${failure}`);
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const accountData = await withDerivConnection(tokenPayload.access_token, async ({ basic }) => {
    const [balanceResult, portfolioResult] = await Promise.all([
      basic.balance({ balance: 1 }),
      basic.portfolio({ portfolio: 1 })
    ]);

    return {
      balance: balanceResult?.balance ?? {},
      portfolio: portfolioResult?.portfolio ?? []
    };
  });

  const loginId = accountData.balance?.loginid ?? `deriv_${oauthState.userId}`;
  const currency = accountData.balance?.currency ?? "USD";
  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000)
    : null;

  const existingLinkedAccount = await prisma.derivAccount.findFirst({
    where: { loginId },
    select: {
      userId: true
    }
  });

  const initiatedByPlaceholder = isPlaceholderUserEmail(oauthState.user.email);
  const targetUserId = existingLinkedAccount?.userId ?? oauthState.userId;
  const stableEmail = buildDerivIdentityEmail(loginId);
  const stableName = buildDerivDisplayName(loginId);

  let targetUser = await prisma.user.findUnique({
    where: { id: targetUserId }
  });

  if (!targetUser) {
    throw new Error("Platform user not found for Deriv callback");
  }

  if (!existingLinkedAccount && initiatedByPlaceholder) {
    targetUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        email: stableEmail,
        name: stableName
      }
    });
  }

  await prisma.derivAccount.updateMany({
    where: { userId: targetUserId },
    data: { isPrimary: false }
  });

  const derivAccount = await prisma.derivAccount.upsert({
    where: {
      userId_loginId: {
        userId: targetUserId,
        loginId
      }
    },
    create: {
      userId: targetUserId,
      loginId,
      currency,
      environment: oauthState.environment,
      tokenEncrypted: encryptSecret(tokenPayload.access_token),
      refreshTokenEncrypted: tokenPayload.refresh_token
        ? encryptSecret(tokenPayload.refresh_token)
        : null,
      tokenExpiresAt: expiresAt,
      scopes: tokenPayload.scope ?? oauthState.requestedScope,
      isPrimary: true,
      balanceCached: Number(accountData.balance?.balance ?? 0),
      equityCached: Number(accountData.balance?.balance ?? 0)
    },
    update: {
      currency,
      tokenEncrypted: encryptSecret(tokenPayload.access_token),
      refreshTokenEncrypted: tokenPayload.refresh_token
        ? encryptSecret(tokenPayload.refresh_token)
        : null,
      tokenExpiresAt: expiresAt,
      scopes: tokenPayload.scope ?? oauthState.requestedScope,
      balanceCached: Number(accountData.balance?.balance ?? 0),
      equityCached: Number(accountData.balance?.balance ?? 0),
      isPrimary: true,
      environment: oauthState.environment
    }
  });

  await prisma.oAuthState.delete({
    where: { state: input.state }
  });

  if (initiatedByPlaceholder && existingLinkedAccount?.userId && existingLinkedAccount.userId !== oauthState.userId) {
    await prisma.user.delete({
      where: { id: oauthState.userId }
    }).catch(() => undefined);
  }

  const hydratedUser = await prisma.user.findUnique({
    where: { id: targetUserId }
  });

  if (!hydratedUser) {
    throw new Error("Unable to hydrate FixCapital user after Deriv callback");
  }

  return {
    derivAccount,
    user: sanitizeUser(hydratedUser),
    isPlatformAuth: initiatedByPlaceholder
  };
}

export async function listDerivAccounts(userId: string) {
  const accounts = await prisma.derivAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return accounts.map(({ tokenEncrypted, refreshTokenEncrypted, ...account }) => account);
}

export async function unlinkDerivAccount(userId: string, accountId: string) {
  const result = await prisma.derivAccount.deleteMany({
    where: {
      id: accountId,
      userId
    }
  });

  if (result.count === 0) {
    throw new Error("Deriv account not found");
  }
}

export async function getDecryptedDerivToken(accountId: string) {
  const account = await prisma.derivAccount.findUnique({
    where: { id: accountId }
  });

  if (!account) {
    throw new Error("Deriv account not found");
  }

  return {
    account,
    accessToken: decryptSecret(account.tokenEncrypted)
  };
}
