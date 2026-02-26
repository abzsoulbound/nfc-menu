# NFC POS System

Core rules:
- User session = person
- NFC tag = physical access point
- Table = staff-controlled grouping

Architecture:
- Next.js App Router
- API routes under `app/api/*`
- Shared domain logic in `lib/*`
- Client state in `store/*`

Primary routes:
- `/menu` public menu
- `/t/[tagId]` customer ordering
- `/staff` staff dashboard
- `/kitchen` kitchen station
- `/bar` bar station

API routes:
- `GET /api/menu`
- `GET|POST|PATCH /api/tags`
- `GET /api/tables`
- `GET|POST /api/sessions`
- `GET|POST|PATCH|PUT /api/orders`
- `POST|PUT /api/staff`

Development:
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. `npm run prisma:generate`
4. `npm run dev`
5. `npm run playwright:install` (first time only, for browser e2e)

Quality checks:
- `npm run typecheck`
- `npm run lint`
- `npm run test`

System QA and stress checks:
- `npm run test:qa`
- `npm run qa:routes`
- `npm run qa:full`
- `npm run test:e2e` (browser flows, starts local app automatically)
- Manual playbook: `docs/QA_STRESS_PLAYBOOK.md`
