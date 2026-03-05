# Atlas Launch Handoff

This document is the authoritative launch handoff for external operations. It is intended to reduce unnecessary Q&A with Atlas by front-loading the repo context, completed engineering work, exact routes, known blockers, and the remaining owner-only tasks.

Atlas should treat this as current as of 2026-03-03.

## 1. Project Snapshot

- App type: Next.js App Router SaaS for multi-tenant NFC restaurant ordering / POS.
- Tenancy model: restaurant slug scoped.
- Payments: Stripe Connect + Stripe Billing.
- Runtime: Prisma + Postgres with an in-process runtime state layer that is also persisted.
- User wants launch completion help, not broad architectural advice.

## 2. What Is Already Done Locally

Repo-side launch preparation has already been completed. Atlas should not restart code review or ask for speculative refactors unless it identifies a true launch blocker.

Implemented already:

- Checkout commit order was made safer:
  - External payment is charged before bill mutation is finalized.
  - Failed provider charge no longer marks the table as paid.
- E2E customer flow was fixed to match the current UI.
- `/order/takeaway` now resolves correctly through the dynamic order page.
- `/waiter*` routes now redirect to canonical `/staff*` routes.
- Playwright now runs against a fresh production build/start instead of `next dev`.
- Static app icon added to avoid dev-time noise.
- QA scripts were updated to behave correctly on Windows/OneDrive.
- Typecheck configuration was stabilized so stale `.next-*` artifacts do not break local validation.

## 3. Local Validation Already Passing

These commands pass locally right now:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run qa:routes`
- `npm run qa:release`

Atlas should assume the repo is locally healthy and focus on external launch completion.

## 4. Temporary Policy (Important)

- The owner is intentionally keeping default role passcodes for now.
- Atlas may flag this as a temporary production risk.
- Atlas should not block the launch workflow on passcode rotation unless it becomes technically impossible to proceed.

## 5. Strong Deployment Assumptions Atlas Should Use

Use these assumptions unless the owner explicitly says otherwise:

- Deployment platform is likely Vercel.
  - Reason: `.env.vercel.production` exists and is part of the current prep flow.
- Production database is likely Neon Postgres.
  - Reason: `.env.neoncheck.production` exists and is part of the current prep flow.
- Payment provider should be treated as Stripe Connect Standard + Stripe Billing.
  - Reason: environment flags and code paths already point there.

Atlas should not repeatedly ask for the platform if it can proceed under these assumptions. It should say it is assuming Vercel + Neon unless corrected.

## 6. Known Runtime / Launch Flags Already Decided

These values have already been aligned locally as the intended production defaults:

- `PAYMENT_MODE=EXTERNAL`
- `PAYMENT_PROVIDER=STRIPE_CONNECT`
- `ENABLE_SETUP_V2=true`
- `ENABLE_DURABLE_RUNTIME_REQUIRED=true`
- `ENABLE_EXTERNAL_PAYMENTS_REQUIRED=true`
- `ENABLE_NAMED_STAFF_ACCOUNTS=true`
- `ENABLE_DEMO_TOOLS=false`
- `DEFAULT_RESTAURANT_SLUG=demo`
- `NEXT_PUBLIC_SUPPORT_EMAIL=ozdemirewdo@gmail.com`
- `NEXT_PUBLIC_SUPPORT_PHONE=07767484464`

Atlas should not ask whether these flags are still desired unless it has a concrete reason.

## 7. Exact Remaining Blockers

The remaining blockers are external, not code-local:

1. Production-grade secrets are still missing or weak.
2. Live Stripe values are still missing.
3. Deployment platform environment variables still need to be populated.
4. Stripe webhook endpoint still needs live dashboard configuration.
5. Stripe Connect OAuth redirect still needs live dashboard configuration.
6. Final remote readiness validation still needs to be executed against the deployed domain.

## 8. Exact Missing Environment Variables

These are the missing values Atlas should help obtain and place.

### `.env.vercel.production` still needs real production values for:

- `SYSTEM_AUTH_SECRET`
  - Current issue: weak / development-like.
- `STAFF_SESSION_SECRET`
  - Current issue: missing.
- `PAYMENT_PROVIDER_SECRET`
  - Current issue: missing.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Current issue: missing.
- `STRIPE_CONNECT_CLIENT_ID`
  - Current issue: missing.
- `STRIPE_CONNECT_OAUTH_REDIRECT_URI`
  - Current issue: missing.
- `STRIPE_WEBHOOK_SECRET`
  - Current issue: missing.
- `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID`
  - Current issue: missing.

### `.env.neoncheck.production` still needs:

- `STRIPE_CONNECT_CLIENT_ID`
- `STRIPE_CONNECT_OAUTH_REDIRECT_URI`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID`

## 9. Exact Stripe Value Mapping

Atlas should use the following mapping and avoid asking what each variable means.

### Secret values that can be generated locally

- `SYSTEM_AUTH_SECRET`
  - Purpose: system auth + signing sensitive internal flows.
- `STAFF_SESSION_SECRET`
  - Purpose: signs tenant-bound staff session tokens.

### Secret / live values that must come from Stripe

- `PAYMENT_PROVIDER_SECRET`
  - Meaning: Stripe live secret API key used by backend payment operations.
  - Expected format: typically `sk_live_...`

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Meaning: Stripe live publishable key used by client-facing payment flows.
  - Expected format: typically `pk_live_...`

- `STRIPE_CONNECT_CLIENT_ID`
  - Meaning: Stripe Connect platform client ID for OAuth.
  - Expected format: typically `ca_...`

- `STRIPE_CONNECT_OAUTH_REDIRECT_URI`
  - Meaning: the exact callback URL registered in Stripe Connect for this app.
  - Strong code-backed default:
    - `https://<YOUR_DOMAIN>/api/payments/stripe/callback`
  - This is the real callback route in the repo.

- `STRIPE_WEBHOOK_SECRET`
  - Meaning: Stripe webhook signing secret for the production webhook endpoint.
  - Expected format: typically `whsec_...`

- `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID`
  - Meaning: Stripe Billing price ID for the platform subscription product used for restaurant billing.
  - Expected format: typically `price_...`

## 10. Exact Stripe Routes From This Codebase

These routes are already implemented and should be treated as canonical.

### Webhook endpoint

- Canonical production webhook endpoint:
  - `/api/webhooks/stripe`
- Backward-compatible alias also exists:
  - `/api/stripe/webhook`
  - This route delegates to the canonical handler.

Relevant code:

- `app/api/webhooks/stripe/route.ts`
- `app/api/stripe/webhook/route.ts`

### Stripe Connect OAuth callback

- Canonical callback route:
  - `/api/payments/stripe/callback`

Relevant code:

- `app/api/payments/stripe/callback/route.ts`

This is the route that receives `code`, `state`, and possible Stripe OAuth errors, exchanges the code, fetches the connected account, updates the restaurant Stripe connection, and redirects back to the tenant admin view.

### Stripe Connect start route

- Manager/admin Connect start route:
  - `/api/payments/stripe/connect`
- Can redirect directly to Stripe when called with:
  - `/api/payments/stripe/connect?redirect=1`

Relevant code:

- `app/api/payments/stripe/connect/route.ts`

## 11. Known App Endpoints Atlas Should Use For Verification

Atlas should not ask what the key endpoints are. They are already known:

- `/api/health`
- `/api/ops/readiness`
- `/api/setup/link`
- `/api/setup/status/[token]`
- `/api/setup/complete`
- `/api/customer/checkout`
- `/api/customer/checkout/intent`
- `/api/customer/checkout/complete`

Additional useful payment-related routes:

- `/api/payments/stripe/connect`
- `/api/payments/stripe/callback`
- `/api/webhooks/stripe`

## 12. Known Validation Goals

Launch should only be considered complete when all of the following are true:

1. Production env values are complete and valid.
2. Production database is reachable.
3. Stripe webhook is configured and signing correctly.
4. Stripe Connect OAuth redirect is configured and round-trips correctly.
5. One live or production-like payment succeeds.
6. One refund succeeds.
7. `/api/health` returns `200`.
8. `/api/ops/readiness` returns `200`.
9. Setup-link lifecycle works end to end.

## 13. PowerShell-Safe Commands Atlas Can Reuse Immediately

Atlas should not ask how to generate secrets on Windows. It can offer these directly.

### Generate a strong random secret in PowerShell

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 | ForEach-Object { [byte]$_ } }))
```

### Alternative hex secret generation in PowerShell

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

### Local production env preflight

```powershell
npm run qa:prod:env -- .env.vercel.production
```

### Local Neon-oriented env preflight

```powershell
npm run qa:prod:env -- .env.neoncheck.production
```

### Release gate

```powershell
npm run qa:release
```

### Remote readiness check

```powershell
curl -i https://<YOUR_DOMAIN>/api/ops/readiness
```

### Remote health check

```powershell
curl -i https://<YOUR_DOMAIN>/api/health
```

## 14. Operational Runbooks Already Present

Atlas does not need to ask whether runbooks exist. They do.

- `docs/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/DB_OUTAGE_RUNBOOK.md`
- `docs/TENANT_SETUP_SUPPORT_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/LAUNCH_OWNER_TASKS.md`
- `docs/CHATGPT_LAUNCH_EXECUTION_PROMPT.md`

## 15. What Atlas Should Do Next (Without Re-asking Basics)

Atlas should proceed in this exact order:

1. Assume Vercel unless corrected.
2. Assume Neon Postgres unless corrected.
3. Help generate:
   - `SYSTEM_AUTH_SECRET`
   - `STAFF_SESSION_SECRET`
4. Walk through Stripe dashboard retrieval for:
   - `PAYMENT_PROVIDER_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_CONNECT_CLIENT_ID`
   - `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID`
5. Tell the owner to set the Stripe Connect redirect URI in Stripe to:
   - `https://<YOUR_DOMAIN>/api/payments/stripe/callback`
6. Tell the owner to create the Stripe production webhook endpoint as:
   - `https://<YOUR_DOMAIN>/api/webhooks/stripe`
7. Tell the owner to copy the resulting webhook signing secret into:
   - `STRIPE_WEBHOOK_SECRET`
8. Tell the owner exactly where to paste each value in the deployment platform env UI.
9. After envs are set, validate:
   - deployment redeployed
   - `/api/health`
   - `/api/ops/readiness`
10. Then validate:
   - Stripe Connect onboarding flow
   - one charge
   - one refund
   - setup-link lifecycle

## 16. Explicit Instruction To Reduce Unnecessary Questions

Atlas should avoid asking for information already present in this handoff.

Atlas may ask follow-up questions only when:

- it needs the actual production domain,
- it needs the actual Stripe account values copied from the dashboard,
- it needs the actual hosting UI confirmation after values are pasted,
- it encounters a concrete error during validation.

Atlas should not keep asking:

- what kind of app this is,
- which payment provider is intended,
- which routes exist,
- whether code is already passing locally,
- whether the goal is launch completion.

## 17. Final Operating Instruction

Atlas should act as a launch operator, not a brainstorming assistant:

- drive one blocking item at a time,
- keep a running checklist and percentage complete,
- minimize theory,
- do not restart solved work,
- finish the external setup and verification.
