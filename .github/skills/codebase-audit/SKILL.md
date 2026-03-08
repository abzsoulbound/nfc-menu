---
name: codebase-audit
description: "Full-spectrum codebase audit covering 130 checks across 13 domains: code understanding, architecture, API/backend, database, security, payments, performance, frontend, UX, reliability, testing, DevOps, documentation. Use when: reviewing code quality, auditing security, optimising performance, validating architecture, generating tests, checking database schema, analysing Stripe payments, evaluating UX flows, detecting dead code, or producing documentation."
argument-hint: Which audit domain or check number(s) to run? (e.g. "security", "41-50", "all")
---

# Codebase Audit Skill

A comprehensive, on-demand audit system with **130 checks** across **13 domains**. Each check produces actionable findings with severity, location, and remediation guidance.

## When to Use

- Pre-launch quality gate or release readiness review
- Security audit before deploying to production
- Performance investigation after observing slowdowns
- Architecture review before major refactoring
- New developer onboarding — understand the codebase fast
- Sprint retrospective — detect accumulated tech debt
- Payment flow validation before going live with Stripe
- Database schema review before a migration

## Audit Domains

| # | Domain | Checks | Reference |
|---|--------|--------|-----------|
| 1 | Code Understanding | 1–10 | [code-understanding.md](./references/code-understanding.md) |
| 2 | Architecture | 11–20 | [architecture.md](./references/architecture.md) |
| 3 | API & Backend | 21–30 | [api-backend.md](./references/api-backend.md) |
| 4 | Database | 31–40 | [database.md](./references/database.md) |
| 5 | Security | 41–50 | [security.md](./references/security.md) |
| 6 | Payments | 51–60 | [payments.md](./references/payments.md) |
| 7 | Performance | 61–70 | [performance.md](./references/performance.md) |
| 8 | Frontend | 71–80 | [frontend.md](./references/frontend.md) |
| 9 | UX | 81–90 | [ux.md](./references/ux.md) |
| 10 | Reliability | 91–100 | [reliability.md](./references/reliability.md) |
| 11 | Testing | 101–110 | [testing.md](./references/testing.md) |
| 12 | DevOps | 111–120 | [devops.md](./references/devops.md) |
| 13 | Documentation | 121–130 | [documentation.md](./references/documentation.md) |

## Procedure

### 1. Parse the Request

Determine which checks to run based on the user's input:
- **"all"** → Run all 130 checks (start with a summary pass, then deep-dive per domain)
- **Domain name** (e.g. "security") → Load that domain's reference and run checks 41–50
- **Check numbers** (e.g. "41-50" or "47") → Load the relevant reference and run specific checks
- **Keyword** (e.g. "Stripe", "N+1", "XSS") → Map to the matching checks and run them

### 2. Gather Context

For each domain being audited:
1. Load the domain reference file from `./references/`
2. Use `search_subagent` or `grep_search` to locate relevant code
3. Read key files identified by the search
4. Cross-reference with project structure (Next.js App Router, Prisma, Stripe, Zustand)

### 3. Execute Checks

For each check in the selected domain:
1. Follow the check's **procedure** from the reference file
2. Classify findings by severity: `CRITICAL | HIGH | MEDIUM | LOW | INFO`
3. Record: check number, title, severity, file location(s), finding description, remediation

### 4. Report Findings

Output a structured report:

```
## Audit Report — [Domain Name]

### Check #XX: [Title]
- **Severity**: HIGH
- **Location**: path/to/file.ts#L42-L58
- **Finding**: Description of what was found
- **Remediation**: Specific action to fix it

### Summary
| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 2     |
| MEDIUM   | 5     |
| LOW      | 3     |
| INFO     | 1     |
```

### 5. Offer Follow-up

After reporting, offer:
- Auto-fix for any findings that can be patched programmatically
- Deeper investigation of any CRITICAL or HIGH findings
- Related domain audits (e.g. after Security, suggest Reliability)

## Severity Definitions

| Level | Meaning |
|-------|---------|
| CRITICAL | Exploitable vulnerability, data loss risk, or production-breaking issue |
| HIGH | Significant bug, security weakness, or major performance problem |
| MEDIUM | Code quality issue, missing validation, or moderate risk |
| LOW | Minor improvement opportunity, style inconsistency |
| INFO | Observation, documentation gap, or suggestion |

## Project Context

This skill is calibrated for a **Next.js 14 App Router** project with:
- **Prisma** (PostgreSQL) for data
- **Stripe Connect** for payments
- **Zustand** for client state
- **Tailwind CSS** for styling
- **Vitest** + **Playwright** for testing
- **Vercel** for deployment
- Multi-tenant restaurant ordering via NFC tags
