# DB Outage Runbook

## Detection
1. `/api/ops/readiness` returns degraded due to `database` check.
2. Errors in setup link creation/completion or tenant resolution.
3. Runtime persistence hydrate/persist failures in logs.

## Immediate Mitigation
1. Keep serving liveness route `/api/health`.
2. Announce degraded mode to operators.
3. For critical production tenants, stop checkout writes until DB recovers.
4. Keep demo tenant usage isolated from production communication.

## Validation Steps
1. Confirm DB host/network accessibility.
2. Validate credentials and secret rotations.
3. Check current migration version.
4. Run a safe query (`SELECT 1`) from app host.

## Recovery Steps
1. Restore DB access.
2. Re-run readiness checks.
3. Force-hydrate runtime state from DB for impacted tenants.
4. Execute smoke flow:
   - menu read
   - order submit
   - checkout + idempotency replay

## After Recovery
1. Re-enable paused feature flags.
2. Compare payment ledger events for gaps.
3. Record outage timeline and corrective actions.
