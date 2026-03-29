# Folder Structure

```text
astrotrade-platform/
├─ apps/
│  ├─ web/
│  │  ├─ app/
│  │  │  ├─ auth/login/
│  │  │  ├─ dashboard/
│  │  │  ├─ copy-trading/
│  │  │  ├─ bot-builder/
│  │  │  ├─ analytics/
│  │  │  ├─ markets/
│  │  │  ├─ components/
│  │  │  └─ lib/
│  │  ├─ package.json
│  │  └─ tailwind.config.ts
│  └─ api/
│     ├─ prisma/schema.prisma
│     ├─ src/config/
│     ├─ src/lib/
│     ├─ src/modules/
│     │  ├─ auth/
│     │  ├─ deriv/
│     │  ├─ copy-trading/
│     │  ├─ bots/
│     │  ├─ analytics/
│     │  ├─ dashboard/
│     │  └─ billing/
│     ├─ src/routes/
│     ├─ src/workers/
│     └─ package.json
├─ docs/folder-structure.md
├─ package.json
└─ .env.example
```

## Runtime responsibilities

- `apps/web`: user-facing SaaS UI, JWT session storage, route-level dashboards, TradingView embeds, Recharts, React Flow bot editor.
- `apps/api`: platform auth, Deriv OAuth callback, encrypted token storage, Prisma persistence, BullMQ queues, Socket.io realtime layer.
- `copy-trading/master-monitor.service.ts`: attaches master accounts to Deriv transaction streams and normalizes trade payloads into queued follower replications.
- `workers/`: isolates copy execution and bot heartbeat workloads for horizontal scaling.

## MVP trade flow

1. User registers on AstroTrade and receives a platform JWT.
2. User links a Deriv account through OAuth with PKCE.
3. Master transactions are streamed from Deriv and normalized into copy signals.
4. BullMQ fanout jobs apply copier risk rules and execute mirrored trades through the copier's Deriv token.
5. Results are logged in `TradeAudit` and surfaced back to the dashboard.
