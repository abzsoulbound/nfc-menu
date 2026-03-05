# UX, UI, and Psychology Playbook (NFC Menu)

## Why These Three Must Be Designed Together
- UX defines sequence and friction: what users do, in what order, and how much effort each step needs.
- UI defines perception and action clarity: what users notice first, trust first, and tap first.
- Psychology defines behavior: users scan before reading, avoid uncertainty, choose defaults, and follow social/authority cues.

When these align, users place orders faster, make fewer errors, and convert to payment with lower abandonment.

## Core Psychological Levers Used in This App
- Cognitive load reduction: short steps, visible progress anchors, grouped inputs, and single-purpose sections.
- Choice architecture: preset tips, suggested share amounts, tabbed task segmentation, and guided-step checkout.
- Trust and risk reduction: secure-payment microcopy, idempotency messaging, live status chips, and transparent totals.
- Behavioral momentum: quick add actions, sticky basket, progressive disclosure, and clear next action labels.
- Social proof framing: optional "trusted flow" chips for restaurants that need confidence signals.

## Page-by-Page Strategy

### `/menu` (Discovery)
Goal: move users from "I just opened this" to "I know what to tap" in under 5 seconds.

Design rules:
- Keep first screen action-oriented (discover/search/start ordering), not informationally dense.
- Use one dominant visual hierarchy: brand context -> availability -> next action.
- Make browsing strategy selectable by tenant:
  - `HERO_FIRST`: storytelling-led dining brands.
  - `SECTION_FIRST`: menu-heavy operations where category speed matters.
  - `SEARCH_FIRST`: repeat guests and large menus.

Psychology linkage:
- Primacy effect: strongest decision cues are placed at top (availability, flow, CTA).
- Information scent: section pills and search placeholders indicate where results come from.

### `/order/[id]` (Selection + Configuration)
Goal: add items with minimal friction while preserving order accuracy.

Design rules:
- Keep section switching cheap and immediate.
- Use the selected ordering flow:
  - `BOTTOM_SHEET_FAST`: balanced default flow.
  - `INLINE_STEPPER`: low-friction high-speed add for simple items.
  - `GUIDED_CONFIGURATOR`: accuracy-first for customizable menus.
- Keep basket access always visible and context-rich (count + value).

Psychology linkage:
- Goal-gradient effect: users continue when progress feels visible; anchors and live totals support this.
- Error prevention over correction: required-choice enforcement before add reduces downstream frustration.

### `/order/review/[tagId]` (Commitment)
Goal: convert intent to confirmed order with zero ambiguity.

Design rules:
- Mirror mental checklist: items -> edits -> totals -> confirm.
- Preserve reversibility with clear back action.
- Tune trust copy by tenant risk posture (`MINIMAL`, `BALANCED`, `HIGH_ASSURANCE`).

Psychology linkage:
- Loss aversion: users fear wrong orders more than extra taps; clear edit visibility lowers this risk.
- Commitment framing: clear final CTA language improves confidence at the decision point.

### `/pay/[tableNumber]` (Conversion)
Goal: convert due amount to completed payment while minimizing abandonment.

Design rules:
- Show due + estimated charge immediately.
- Offer flow variants:
  - `ONE_PAGE`: all controls visible for power users.
  - `GUIDED_SPLIT`: staged progression for mixed-group tables.
  - `EXPRESS_FIRST`: fast path with suggested amount and default tip.
- Keep secure payment state explicit (ready, confirming, processing, complete).

Psychology linkage:
- Decision fatigue reduction: guided steps and presets reduce micro-decisions.
- Default bias: default tip and suggested share drive faster completion without coercion.

### `/guest-tools` (Retention and Re-engagement)
Goal: move from transactional visit to repeat relationship.

Design rules:
- Keep full capability, but allow layout strategies:
  - `ALL_IN_ONE`: browse everything at once.
  - `TASK_TABS`: focused task execution.
  - `POST_PURCHASE_PROMPT`: feedback + account capture priority.
- Keep status feedback immediate (reservation/waitlist/feedback submitted states).

Psychology linkage:
- Recency effect: post-purchase flows prioritize actions users are most likely to complete right after paying.
- Attention gating: tabs reduce competing calls-to-action.

## Tenant Configuration Framework (Implemented)
Restaurants can now set:
- Discovery flow, ordering flow, review flow, checkout flow, engagement flow.
- Progress-anchor visibility.
- Social-proof emphasis.
- Trust microcopy level.
- Default tip percentage.

This enables UX variation without code forks.

## Web Developer Execution Checklist
- Prioritize interaction architecture first, then visual polish.
- Keep CTA text action-specific and context-specific.
- Use defaults to accelerate decisions, not hide choices.
- Always surface state transitions (loading, success, pending, error).
- Keep reversible paths visible before irreversible actions.
- Validate with task-level metrics (time to first add, add-to-review rate, review-to-pay conversion).

## Suggested Measurement Metrics
- Menu discovery efficiency: time to first item add.
- Ordering efficiency: adds per minute and customization completion rate.
- Checkout efficiency: payment completion rate and time-to-pay.
- Retention intent: guest-tool interactions after checkout.
- Error quality: edit-before-submit rate and duplicate-submit incidence.