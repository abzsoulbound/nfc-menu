# Marlo's Brasserie Ordering SaaS

Core rules:
- User session = person
- NFC tag = physical access point
- Table = staff-controlled grouping

Architecture:
- App Router with server APIs under app/api/*
- Domain logic in lib/*
- Stateless UI with client stores in store/*

Routes:
- /order/menu public menu (canonical)
- /order/t/[tagId] customer ordering (canonical)
- /staff operational control
- /kitchen kitchen station
- /bar bar station

Development:
- npm install
- create a `.env` file
- set Vercel Postgres/Neon URLs:
  - `POSTGRES_PRISMA_URL` (pooled)
  - `POSTGRES_URL_NON_POOLING` (direct)
- set TABLE_NUMBERS to fixed table numbers (example: `1-20,30,32`)
- set role passcodes for bootstrap:
  - `ADMIN_PASSCODE`
  - `WAITER_PASSCODE`
  - `BAR_PASSCODE`
  - `KITCHEN_PASSCODE`
- optional security/session env:
  - `STAFF_PASSCODE_PEPPER`
  - `STAFF_SESSION_PEPPER`
  - `STAFF_SESSION_TTL_HOURS`
- npm run prisma:migrate:deploy
- npm run db:check
- npm run test
- npm run dev

Health checks:
- `GET /api/health` returns service/db status plus latency and request id.

Online DB Cutover:
1. Provision Vercel Postgres (Neon) and attach integration to the project.
2. Put connection strings in `.env` as:
  - `POSTGRES_PRISMA_URL` (pooled)
  - `POSTGRES_URL_NON_POOLING` (direct)
3. Apply schema: `npm run prisma:migrate:deploy`.
4. Verify connectivity and schema: `npm run db:check`.
5. Start app: `npm run dev`.

Useful Prisma commands:
- `npm run prisma:migrate:status`
- `npm run prisma:generate`
- `npm run prisma:db:push` (dev-only shortcut; prefer migrations for shared envs)
