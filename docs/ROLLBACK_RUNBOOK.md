# Rollback Runbook

## When To Roll Back
1. Checkout failures spike after release.
2. Tenant isolation regression is suspected.
3. Setup flow failure rate blocks onboarding.
4. Readiness remains degraded post-fix attempts.

## Rollback Order
1. Disable feature flags:
   - `ENABLE_EXTERNAL_PAYMENTS_REQUIRED`
   - `ENABLE_NAMED_STAFF_ACCOUNTS`
   - `ENABLE_SETUP_V2`
   - `ENABLE_DURABLE_RUNTIME_REQUIRED`
2. Deploy previous stable app artifact.
3. Re-run readiness checks.
4. Validate high-value user journeys.

## Data Safety
1. Do not delete tenant data during rollback.
2. Preserve payment ledger and audit records.
3. Keep migration history unchanged unless explicit DB rollback plan exists.

## Verification
1. `GET /api/health` returns ok.
2. `GET /api/ops/readiness` checks pass or expected degraded reason is known.
3. One full flow succeeds:
   - tenant resolution
   - order submit
   - checkout with idempotency replay.

## Follow-up
1. Open incident + root cause record.
2. Add regression tests before re-release.
