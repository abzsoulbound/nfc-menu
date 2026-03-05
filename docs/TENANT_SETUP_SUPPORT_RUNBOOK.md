# Tenant Setup Support Runbook

## Objective
Resolve setup-link onboarding issues quickly without manual tenant handholding.

## Inputs To Collect
1. Setup URL token (or last 8 chars).
2. Restaurant name and expected slug.
3. Exact error message + timestamp.
4. Whether link was previously used.

## Diagnostics
1. Check `GET /api/setup/status/[token]`.
2. Confirm status:
   - `READY`
   - `EXPIRED`
   - `CONSUMED`
   - `INVALID`
3. Validate feature flag `ENABLE_SETUP_V2`.
4. Confirm DB readiness.

## Resolution Paths
1. `EXPIRED`: issue new setup link.
2. `CONSUMED`: send launch URLs from the created restaurant slug.
3. `INVALID`: verify copied token; regenerate link.
4. Validation errors: correct payload (name, slug format, URLs).

## Re-issue Setup Link
1. Call `POST /api/setup/link` with `x-system-auth`.
2. Include bootstrap defaults where useful.
3. Share returned setup link and status URL.

## Completion Verification
1. Confirm setup completion response includes:
   - launch URL
   - staff login URL
   - initial passcodes
   - checklist score
2. Validate `/r/[slug]?next=/menu` and `/r/[slug]?next=/staff-login`.
