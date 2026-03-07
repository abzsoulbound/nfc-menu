# ATLAS Launch Handoff

This handoff is blocked until all production-only values are supplied outside Git.

## Current Blockers
1. Stripe live values are intentionally absent from tracked files.
2. Runtime/db readiness must be green in production (`/api/ops/readiness` = `200`).
3. Remote checkout smoke must pass against the live tenant.

## Required Stripe Live Inputs (Do Not Commit)
- `PAYMENT_PROVIDER_SECRET` (`sk_live_...` or `rk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_...`)
- `STRIPE_CONNECT_CLIENT_ID` (`ca_...`)
- `STRIPE_CONNECT_OAUTH_REDIRECT_URI` (https URL on your production domain)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID` (`price_...`)

## Gate Commands
```bash
npm run qa:secrets
npm run qa:prod:env -- .env.neoncheck.production
npm run qa:release:prod
npm run qa:smoke:remote -- --base-url https://<YOUR_DOMAIN> --tenant-slug <YOUR_LIVE_TENANT_SLUG> --admin-passcode <ADMIN_PASSCODE>
```

## Go/No-Go Rule
Launch only when all gate commands pass and live Stripe + webhook + refund tests are validated on production infrastructure.
