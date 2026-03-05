# Fable Stores QA + Stress Playbook

This playbook is for full-system simulation with multiple real devices and roles.

## 1. Objective
Verify the system works end-to-end under realistic load:
- customer ordering (dine-in + takeaway),
- waiter handoff,
- kitchen/bar prep queues,
- manager/admin control paths,
- lock/close failure states.

## 2. Environment Setup
1. Run backend/frontend in production-like mode:
```bash
npm run build
npm run start
```
2. Verify readiness endpoint before running the matrix:
```bash
curl -i http://localhost:3000/api/ops/readiness
```
3. Ensure passcode envs are set in `.env.local`:
- `WAITER_PASSCODES`
- `KITCHEN_PASSCODES`
- `BAR_PASSCODES`
- `MANAGER_PASSCODES`
- `ADMIN_PASSCODES`
4. Open devices on same deployed URL.

## 3. Device Matrix
Use at least 6 devices/browsers:
1. Customer A (dine-in tag)
2. Customer B (same table tag, different session/device)
3. Waiter iPad (`/staff`)
4. Kitchen iPad (`/kitchen`)
5. Bar iPad (`/bar`)
6. Manager/Admin laptop (`/manager`, `/admin`)

## 4. Route-by-Route Acceptance

## 4.1 Customer/Public
1. `/menu`
- Categories sticky and highlight current section while scrolling.
- Item pricing renders with the £ symbol.
- No route crash; empty state only if menu seed absent.
2. `/order/[tagId]`
- Cart quantity changes update floating pill immediately.
- Customize sheet opens and edits update item price.
- Locked/closed table state blocks ordering and shows clear status.
3. `/order/takeaway`
- Same UX as dine-in, with takeaway context labeling.
4. `/order/review/[tagId]`
- Shows line items and total.
- Submit returns to order page and clears submitted cart items.
5. `/order/[id]/review`
- Timeline split into initial order + add-ons in chronological order.
6. `/order/[tagId]` while table is locked/closed
- Order submit is blocked with a clear closed/locked state message.

## 4.2 Staff/Operations
1. `/staff-login`
- 4-digit keypad accepts only 4 digits.
- Invalid code shows error and clears entered code.
- Valid code routes to role-appropriate destination.
2. `/staff`
- Ready queue oldest-first.
- `Mark delivered` removes ready items.
- Unassigned tags visible.
3. `/staff/tables`
- Lock/unlock works.
- Close paid/unpaid requires confirmation modal.
4. `/staff/tags`
- Tag assignment/unassignment updates immediately.
5. `/staff/sessions`
- Create staff session and open editor without navigation dead-ends.
6. `/kitchen` and `/bar`
- Queue oldest-first.
- Tap ticket opens detail.
- `Mark sent` moves items to waiter ready queue.
- Reprint works via button and long-press shortcut.
7. `/manager`
- Quick links all open correct targets.
8. `/admin`
- Environment status panel renders without exposing full secrets.

## 5. High-Value Stress Scenarios

## 5.1 Shared Table Collision
1. Two customer devices use same `tagId`.
2. Submit overlapping orders within 10-20 seconds.
3. Expected:
- both orders accepted,
- review timeline shows initial + add-ons,
- kitchen/bar queues include all lines.

## 5.2 Station Burst
1. Submit 20+ mixed orders rapidly (bar + kitchen items).
2. Expected:
- queues remain sorted oldest-first,
- no UI freeze on queue updates,
- waiter sees all ready items after station send.

## 5.3 Takeaway Burst
1. Submit 15+ takeaway orders in quick succession.
2. Expected:
- table number `0` grouping remains stable,
- no cross-contamination with dine-in tables.

## 5.4 Lock and Close Mid-Service
1. Start with active customer ordering.
2. Lock table from waiter tables page.
3. Attempt new customer submit.
4. Close table as paid/unpaid.
5. Expected:
- new orders blocked immediately after lock/close,
- no staff queue corruption.

## 5.5 Auth and Access Guarding
1. Access protected staff pages without login.
2. Expected redirect to `/staff-login`.
3. Login with role-specific code and retest.
4. Expected role-allowed pages open successfully.

## 5.6 Multi-Restaurant Parallel Isolation
1. Open two tenants in parallel with separate restaurant slug URLs (`/r/{slug}`).
2. Submit orders in both tenants at the same time.
3. Expected:
- no queue cross-contamination across tenants,
- event streams remain tenant-scoped,
- checkout updates only the correct tenant bill/receipt trail.

## 6. Known Practical Limits to Watch
1. Polling views update every few seconds; very high volume can create visual churn.
2. Runtime in-memory store resets on process restart in this implementation.
3. Browser-local cart/session state can vary per device/tab by design.

## 7. Bug Capture Template
For every issue capture:
1. Route
2. Role/device
3. Exact timestamp
4. Steps to reproduce (numbered)
5. Expected vs actual
6. Screenshot/video
7. Severity (`critical`, `major`, `minor`)
