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
- `/sales-demo` owner-focused live simulator console for sales calls
- `/order/[tagId]` customer ordering
- `/pay/[tableNumber]` customer pay-at-table checkout (split/tip/promo/receipt)
- `/r/[slug]?next=/menu` set active restaurant context cookie and redirect
- `/setup/[token]` self-serve restaurant provisioning link
- `/guest-tools` customer loyalty/reservation/waitlist/feedback tools
- `/staff` staff dashboard
- `/kitchen` kitchen station
- `/bar` bar station
- `/manager` manager operations
- `/manager/features` manager growth/engagement controls
- `/manager/customize` manager customization for menu/review guest pages
- `/demo` demo hub (disabled in production unless `ENABLE_DEMO_TOOLS=true`)

API routes:
- `GET /api/menu`
- `POST /api/menu/import/csv` (manager/admin CSV import with dry-run validation)
- `GET|POST|PATCH /api/tags`
- `GET /api/tables`
- `GET|POST /api/sessions`
- `GET|POST|PATCH|PUT /api/orders`
- `POST|PUT /api/staff`
- `GET|POST|PUT /api/customer/checkout` (`PUT` = manager/admin refund path)
- `GET|POST /api/customer/engagement`
- `GET /api/health` (liveness)
- `GET /api/ops/readiness` (env + dependency readiness checks)
- `GET|PATCH /api/restaurant` (active restaurant profile + manager/admin customization updates)
- `GET /api/tenant/bootstrap` (tenant + feature + permission bootstrap payload)
- `POST /api/setup/link` (system-auth protected setup link creation)
- `POST /api/setup/link/admin` (admin-auth setup link creation from the UI)
- `POST /api/setup/complete` (token-based self-serve restaurant provisioning)
- `GET /api/setup/status/[token]` (setup token pre-validation/status)

Development:
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. `npm run prisma:generate`
4. `npm run dev`
5. `npm run playwright:install` (first time only, for browser e2e)
6. Demo launcher (opens all required demo tabs in default browser):
   - `npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile first-run`
   - `npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile rush-hour`
   - `npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile full`
   - `npm run demo:auto` (zero-arg autopilot, includes guided feed autostart)
   - Add `--auto-feed --auto-next` to auto-enable guided feed and jump to first step.
7. Portable launchers (no manual terminal typing once copied):
   - Windows: double-click `Run-Demo.bat` (optional profile arg: `first-run`, `rush-hour`, `full`)
   - macOS/Linux: run `bash run-demo.sh` (optional profile arg: `first-run`, `rush-hour`, `full`)

Quality checks:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run qa:prod:env -- .env.neoncheck.production` (fails on insecure production env values)
- `npm run qa:routes:prod` (route smoke with `.env.neoncheck.production`)
- `npm run qa:release:prod` (full launch gate with `.env.neoncheck.production`)
- `npm run qa:smoke:remote -- --base-url https://example.com --tenant-slug fable-stores --admin-passcode <ADMIN_PASSCODE>`

Payment mode:
- `PAYMENT_MODE=SIMULATED` for internal/demo payments.
- For production simulated mode, set `ALLOW_SIMULATED_PAYMENTS=true` explicitly.
- `PAYMENT_MODE=EXTERNAL` requires `PAYMENT_PROVIDER` and `PAYMENT_PROVIDER_SECRET`.
- Use `Idempotency-Key` on `POST /api/customer/checkout` to prevent duplicate charge attempts.
- In production non-demo tenant checkout, `Idempotency-Key` is required.

Staff session security:
- Login now issues signed `staff_auth` session tokens (instead of storing raw passcodes in cookies).
- Optional: set `STAFF_SESSION_SECRET`; otherwise the app falls back to `SYSTEM_AUTH_SECRET`.
- Staff session tokens are now tenant-bound; a token from one restaurant cannot authorize another restaurant context.

Multi-restaurant onboarding:
- The app now supports per-restaurant runtime isolation (orders/sessions/menu state and realtime streams).
- Fable Stores is seeded as the first demo restaurant, but the default fallback tenant is controlled by `DEFAULT_RESTAURANT_SLUG` (`demo` by default).
- Create a setup link with system auth:
  - `curl -X POST http://localhost:3000/api/setup/link -H "x-system-auth: <SYSTEM_AUTH_SECRET>" -H "content-type: application/json" -d "{\"expiresInHours\":72,\"bootstrap\":{\"location\":\"Leicester\"}}"`
- Send the returned `setupLink` to the restaurant; they complete setup once and receive launch/login URLs plus initial passcodes.
- Managers can then self-serve guest-facing copy and CTA customization from `/manager/customize`.

V1 rollout flags:
- `ENABLE_SETUP_V2`
- `ENABLE_DURABLE_RUNTIME_REQUIRED`
- `ENABLE_NAMED_STAFF_ACCOUNTS`
- `ENABLE_EXTERNAL_PAYMENTS_REQUIRED`

System QA and stress checks:
- `npm run test:qa`
- `npm run qa:routes`
- `npm run qa:routes:prod`
- `npm run qa:full`
- `npm run qa:release`
- `npm run qa:release:prod`
- `npm run test:e2e` (browser flows, starts local app automatically)
- Manual playbook: `docs/QA_STRESS_PLAYBOOK.md`

Launch handoff docs:
- Owner-required external tasks: `docs/LAUNCH_OWNER_TASKS.md`
- Copy/paste prompt for ChatGPT-guided execution: `docs/CHATGPT_LAUNCH_EXECUTION_PROMPT.md`
- UX/UI psychology playbook (page-by-page): `docs/UX_UI_PSYCHOLOGY_PLAYBOOK.md`

Remote checkout smoke:
- Example:
```bash
npm run qa:smoke:remote -- \
  --base-url https://fable-stores-nfc-menu.vercel.app \
  --tenant-slug <YOUR_LIVE_TENANT_SLUG> \
  --admin-passcode <ADMIN_PASSCODE>
```
- The script seeds tenant context, logs in as admin, unlocks service, refreshes a table, submits one order, confirms `dueTotal > 0`, then completes checkout.
