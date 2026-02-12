# NFC POS System

Core rules:
- User session = person
- NFC tag = physical access point
- Table = staff-controlled grouping

Architecture:
- App Router with server APIs under app/api/*
- Domain logic in lib/*
- Stateless UI with client stores in store/*

Routes:
- /menu public menu
- /t/[tagId] customer ordering
- /staff operational control
- /kitchen kitchen station
- /bar bar station

Development:
- npm install
- create a `.env` file
- set DATABASE_URL to your managed Postgres URL
- set TABLE_NUMBERS to fixed table numbers (example: `1-20,30,32`)
- npm run prisma:migrate:deploy
- npm run db:check
- npm run dev

Online DB Cutover:
1. Provision a managed Postgres database (Neon/Supabase/RDS).
2. Put its connection string in `.env` as `DATABASE_URL`.
3. Apply schema: `npm run prisma:migrate:deploy`.
4. Verify connectivity and schema: `npm run db:check`.
5. Start app: `npm run dev`.

Useful Prisma commands:
- `npm run prisma:migrate:status`
- `npm run prisma:generate`
- `npm run prisma:db:push` (dev-only shortcut; prefer migrations for shared envs)
