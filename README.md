# AstroTrade

AstroTrade is a full-stack SaaS overlay for Deriv that focuses on copy trading, no-code automation, AI-assisted analytics, and live trading dashboards while keeping user funds and order execution inside each user's own Deriv account.

## Stack

- `apps/web`: Next.js 15, TypeScript, Tailwind CSS, shadcn-style UI primitives, Recharts, React Flow, Socket.io client.
- `apps/api`: Fastify, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Socket.io, `@deriv/deriv-api`.
- `PostgreSQL`: user profiles, linked Deriv accounts, copy relationships, bot configs, audit trails.
- `Redis`: live leaderboards, pub/sub fanout, BullMQ queues, hot cache.

## MVP included

- Platform registration/login with JWT auth.
- Deriv OAuth 2.0 Authorization Code flow with PKCE and encrypted token storage.
- Deriv account linking for demo/real environments.
- Copy trading dashboard with master leaderboard, risk controls, and queue-backed replication pipeline.
- Live master trade monitoring from Deriv transaction streams.
- Bot builder UI with templates and backend bot configs.
- AI analytics widgets with rule-based signals and volatility placeholders.
- Stripe subscription plumbing and KYC placeholder surfaces.

## Local setup

1. Copy `.env.example` to `.env` and fill in the values for Deriv, Stripe, PostgreSQL, and Redis.
2. Install packages:

```bash
npm install
```

3. Generate Prisma client and run a migration:

```bash
npm run prisma:generate
npm run prisma:migrate --workspace @astrotrade/api
```

4. Start the platform:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Prisma note

- `npm install` no longer hard-fails if Prisma engine downloads are blocked during `postinstall`.
- If Prisma generation is skipped, rerun this once you have network access:

```bash
npm run prisma:generate
```

## Demo login

- Email: `demo@astrotrade.app`
- Password: `DemoPass123!`

## Demo-first Deriv setup

- The code defaults to `DERIV_ENVIRONMENT=demo`.
- Register your redirect URI with Deriv exactly as `DERIV_OAUTH_REDIRECT_URI`.
- The OAuth implementation is wired for Deriv's documented OAuth 2.0 authorization and token endpoints.
- Add your `affiliate_token` and `utm_campaign` to attribute new referrals.

## Important notices

- AstroTrade never stores Deriv passwords or directly holds customer funds.
- Past performance is not indicative of future results.
- Copy trading, automated execution, and leveraged instruments carry substantial risk and may not be suitable for all investors.
- Production deployment should use HTTPS, secret rotation, managed Redis/Postgres, durable BullMQ workers, and external monitoring.
