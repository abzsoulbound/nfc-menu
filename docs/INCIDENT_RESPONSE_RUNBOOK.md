# Incident Response Runbook

## Scope
Operational incidents affecting checkout, ordering, tenant isolation, auth, or onboarding.

## Severity
1. `SEV-1`: checkout outage, cross-tenant risk, full production outage.
2. `SEV-2`: partial route outage, degraded performance, onboarding blocked.
3. `SEV-3`: non-critical bugs with workaround.

## Immediate Actions
1. Confirm incident and capture first timestamp.
2. Identify impacted tenant slugs and routes.
3. Freeze risky changes and pause rollout flags if needed.
4. Notify stakeholders with severity and ETA for next update.

## Technical Checklist
1. Check `/api/health` and `/api/ops/readiness`.
2. Verify DB connectivity and migration state.
3. Review auth failures and setup token misuse logs.
4. Validate payment mode and provider config for impacted tenant.
5. Confirm runtime persistence is healthy for the tenant.

## Containment
1. Disable risky features via:
   - `ENABLE_SETUP_V2`
   - `ENABLE_DURABLE_RUNTIME_REQUIRED`
   - `ENABLE_NAMED_STAFF_ACCOUNTS`
   - `ENABLE_EXTERNAL_PAYMENTS_REQUIRED`
2. Re-route tenant traffic to stable flow.
3. Block compromised tokens/sessions if security-related.

## Recovery
1. Deploy fix with `qa:release` gate.
2. Re-run readiness checks.
3. Verify end-to-end critical paths:
   - setup link flow
   - customer checkout
   - station queue flow
4. Restore paused flags gradually.

## Postmortem
1. Root cause summary.
2. Blast radius and impact duration.
3. Preventive actions and owners.
