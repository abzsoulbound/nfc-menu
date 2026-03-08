# Payments (Checks 51–60)

## Check 51: Stripe Integration Validation

**Goal**: Verify the Stripe integration is correctly and securely implemented.

**Procedure**:
1. Read `lib/payments.ts`, `lib/stripeConnectBilling.ts`, `lib/stripeConnectSample.ts`
2. Verify Stripe SDK initialisation uses correct API version
3. Check that `stripe` instance is created server-side only
4. Verify Connect account handling (`stripeAccountId` passed correctly)
5. Check that test/live mode is correctly gated by environment
6. Verify Stripe error handling covers common failure modes

**Output**: Stripe integration health report.

---

## Check 52: Webhook Signature Verification Analysis

**Goal**: Ensure Stripe webhooks verify signatures to prevent spoofing.

**Procedure**:
1. Find Stripe webhook handler route(s)
2. Verify `stripe.webhooks.constructEvent()` is called with the raw body and signing secret
3. Check that the raw body is preserved (not parsed as JSON first)
4. Verify the webhook signing secret comes from environment variables
5. Check that signature verification failures return 400
6. Verify different webhook endpoints use different signing secrets if applicable

**Output**: Webhook signature verification status per endpoint.

---

## Check 53: Payment Status Handling Validation

**Goal**: Verify all payment states are handled correctly.

**Procedure**:
1. Map the payment state machine: pending → processing → succeeded/failed/cancelled
2. Verify each state transition is handled in code
3. Check for stuck payments (no timeout or recovery)
4. Verify payment status is synced between Stripe and local DB
5. Check that failed payments don't mark orders as paid
6. Verify partial payment handling if applicable

**Output**: Payment state machine diagram with unhandled states flagged.

---

## Check 54: Duplicate Charge Prevention Analysis

**Goal**: Ensure customers cannot be charged twice for the same order.

**Procedure**:
1. Check for idempotency keys on Stripe payment creation
2. Verify deterministic idempotency key generation (SHA256 in `lib/payments.ts`)
3. Check that retry logic uses the same idempotency key
4. Verify database-level duplicate prevention (unique constraints on payment refs)
5. Check UI prevents double-click on pay button
6. Verify webhook deduplication for payment events

**Output**: Duplicate charge prevention coverage report.

---

## Check 55: Refund Logic Validation

**Goal**: Verify refund handling is correct and auditable.

**Procedure**:
1. Search for refund-related code (`refund`, `stripe.refunds`)
2. Check that refunds are linked to original payments
3. Verify partial refund support if applicable
4. Check that refund status is tracked in the database
5. Verify refund amounts are validated (can't refund more than charged)
6. Check for audit trail of refund actions (who, when, why)

**Output**: Refund logic audit with completeness assessment.

---

## Check 56: Checkout Flow Validation

**Goal**: Verify the complete checkout flow is secure and reliable.

**Procedure**:
1. Trace the checkout flow from cart → payment → order confirmation
2. Check for race conditions (concurrent checkout attempts)
3. Verify price is calculated server-side (not trusted from client)
4. Check that cart items are validated against current menu/prices
5. Verify stock/availability is checked at checkout time
6. Check for abandoned checkout handling

**Output**: Checkout flow security and reliability report.

---

## Check 57: Currency Handling Validation

**Goal**: Ensure currency amounts are handled correctly without rounding errors.

**Procedure**:
1. Check that monetary values use integer cents (not floating point)
2. Verify currency code is consistently applied (GBP, EUR, USD)
3. Check for floating-point arithmetic on money values
4. Verify Stripe amounts are in smallest currency unit (pence/cents)
5. Check display formatting matches stored precision
6. Verify tax calculations use correct rounding

**Output**: Currency handling audit.

---

## Check 58: Payment Failure Recovery Analysis

**Goal**: Verify the system recovers gracefully from payment failures.

**Procedure**:
1. Identify all payment failure scenarios (card declined, network error, Stripe outage)
2. Check that failed payments show clear user-facing error messages
3. Verify the order state is correct after payment failure (not marked as paid)
4. Check for retry mechanism with exponential backoff
5. Verify the customer can attempt payment again after failure
6. Check for admin visibility into failed payments

**Output**: Payment failure recovery assessment.

---

## Check 59: Webhook Retry Safety Analysis

**Goal**: Ensure webhook handlers are safe to receive the same event multiple times.

**Procedure**:
1. Check that webhook handlers are idempotent
2. Verify event IDs are tracked to detect redeliveries
3. Check that webhook processing is atomic (all-or-nothing)
4. Verify side effects (emails, notifications) have deduplication
5. Check that webhook handler responds within Stripe's timeout
6. Verify dead letter handling for permanently failing webhooks

**Output**: Webhook retry safety report.

---

## Check 60: Payment Reconciliation Validation

**Goal**: Verify payments in the system match Stripe records.

**Procedure**:
1. Check for reconciliation logic or scripts
2. Verify payment records include Stripe payment intent IDs
3. Check for orphaned payments (in DB but not in Stripe, or vice versa)
4. Verify that refunds are reflected in local records
5. Check for currency/amount mismatches between local and Stripe
6. Verify periodic reconciliation capability exists or recommend implementation

**Output**: Reconciliation capability assessment.
