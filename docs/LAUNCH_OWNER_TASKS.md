# Launch Owner Tasks (Required Outside Codex)

These steps require your external accounts, legal decisions, payment contracts, or production infrastructure access.

## 1) Infrastructure + Database
1. Provision production Postgres.
2. Set `DATABASE_URL` in production secrets.
3. Run:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```
4. Verify:
```bash
curl -i https://<YOUR_DOMAIN>/api/ops/readiness
```

## 2) Secrets + Runtime Flags
Set production secrets (never `changeme`):
- `SYSTEM_AUTH_SECRET`
- `STAFF_SESSION_SECRET`
- role passcodes and/or named staff account policy
- payment provider secrets

Before launch, run:
```bash
npm run qa:secrets
npm run qa:prod:env -- .env.neoncheck.production
```

Set rollout flags for launch:
- `ENABLE_SETUP_V2=true`
- `ENABLE_DURABLE_RUNTIME_REQUIRED=true`
- `ENABLE_NAMED_STAFF_ACCOUNTS=true`
- `ENABLE_EXTERNAL_PAYMENTS_REQUIRED=true`

## 3) Payment Provider Go-Live
Codex implemented a provider adapter contract, but real PSP settlement requires your account config.
You must:
1. Create live PSP account.
2. Configure webhook endpoints and signing secret.
3. Set:
- `PAYMENT_MODE=EXTERNAL`
- `PAYMENT_PROVIDER=STRIPE_CONNECT` (or your Stripe Connect alias)
- `PAYMENT_PROVIDER_SECRET=<sk_live_... or rk_live_...>`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live_...>`
- `STRIPE_CONNECT_CLIENT_ID=<ca_...>`
- `STRIPE_CONNECT_OAUTH_REDIRECT_URI=https://<YOUR_DOMAIN>/api/stripe/connect/callback`
- `STRIPE_WEBHOOK_SECRET=<whsec_...>`
- `STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID=<price_...>`
4. Run real card test + refund test in production-like environment.

## 4) Domain, SSL, DNS, and Email/SMS
1. Point production domain to your host.
2. Confirm SSL cert issuance.
3. Configure transactional email/SMS providers if used in customer flows.

## 5) Legal and Compliance
You must finalize:
1. Terms of Service.
2. Privacy Policy.
3. Cookie/marketing consent policy.
4. Data retention/deletion policy.
5. PCI scope confirmation with your PSP.

## 6) Operational Monitoring and Alerting
External monitoring integrations require your accounts:
1. Error tracking (Sentry/Datadog/etc).
2. Uptime checks.
3. Alert routing (email/Slack/PagerDuty).
4. On-call ownership.

## 7) Production Dry Run
Run full gate:
```bash
npm run qa:release:prod
```
Then execute multi-device QA from:
- `docs/QA_STRESS_PLAYBOOK.md`

Then run the remote checkout smoke against the deployed app:
```bash
npm run qa:smoke:remote -- \
  --base-url https://<YOUR_DOMAIN> \
  --tenant-slug <YOUR_LIVE_TENANT_SLUG> \
  --admin-passcode <ADMIN_PASSCODE>
```
The smoke now hard-fails if `/api/ops/readiness` is not `200` before checkout.

## 8) First Customer Onboarding (Fable demo preserved)
1. Generate setup link:
```bash
curl -X POST https://<YOUR_DOMAIN>/api/setup/link \
  -H "x-system-auth: <SYSTEM_AUTH_SECRET>" \
  -H "content-type: application/json" \
  -d "{\"expiresInHours\":72,\"bootstrap\":{\"location\":\"Leicester\"}}"
```
2. Send `setupLink` to customer.
3. Confirm they can reach:
- customer launch URL
- staff login URL
4. Confirm first paid checkout and refund path.

## 9) Go/No-Go Criteria
Go live only when all are true:
1. `/api/health` is `200`.
2. `/api/ops/readiness` is `200`.
3. External payment charge + refund successful.
4. Setup-link lifecycle tested (`READY` -> `CONSUMED`).
5. Multi-tenant isolation smoke passed.
