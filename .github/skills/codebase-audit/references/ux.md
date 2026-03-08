# UX (Checks 81–90)

## Check 81: User Journey Analysis

**Goal**: Map and evaluate the complete user journey for each persona.

**Procedure**:
1. Identify personas: customer (NFC scan → order → pay), waiter, kitchen staff, bar staff, manager
2. Map each persona's journey through the app step-by-step
3. Identify friction points (unnecessary steps, confusing navigation)
4. Check for dead ends (states with no clear next action)
5. Verify the happy path is optimised for speed
6. Assess error recovery at each journey step

**Output**: Per-persona journey map with friction analysis.

---

## Check 82: Checkout Flow Evaluation

**Goal**: Evaluate the checkout experience for speed, clarity, and trust.

**Procedure**:
1. Trace the complete checkout flow from cart to payment confirmation
2. Count the number of steps/screens required
3. Check for unnecessary information requests
4. Verify order summary is visible during payment
5. Check for trust signals (secure payment badges, clear pricing)
6. Verify post-payment confirmation is immediate and clear

**Output**: Checkout flow scorecard with improvement suggestions.

---

## Check 83: Menu Navigation Optimisation

**Goal**: Ensure menu browsing is fast and intuitive.

**Procedure**:
1. Check menu category organisation and naming
2. Verify items are scannable (clear names, prices, descriptions)
3. Check for search/filter functionality
4. Verify allergen/dietary information is accessible
5. Check menu load time and perceived performance
6. Verify smooth scrolling and category jumping

**Output**: Menu navigation UX report.

---

## Check 84: Error Message Clarity Analysis

**Goal**: Ensure all error messages are user-friendly and actionable.

**Procedure**:
1. Search for all user-facing error messages in the codebase
2. Check each message for: clarity, actionability, and tone
3. Verify no technical jargon appears in user-facing errors
4. Check that error messages explain what happened AND what to do next
5. Verify error messages don't expose system internals
6. Check for generic "Something went wrong" messages that need specificity

**Output**: Error message audit with rewrite suggestions.

---

## Check 85: Loading State Validation

**Goal**: Verify all async operations show appropriate loading indicators.

**Procedure**:
1. Find all data-fetching operations (API calls, server components)
2. Check each has a loading state (spinner, skeleton, shimmer)
3. Verify `loading.tsx` files exist for route segments
4. Check for loading states on form submissions
5. Verify loading indicators are appropriately sized and positioned
6. Check that loading states don't cause layout shift

**Output**: Loading state coverage map.

---

## Check 86: Empty State Validation

**Goal**: Verify the UI handles empty data gracefully.

**Procedure**:
1. Identify all list/collection views (orders, menu items, cart)
2. Check each for empty state handling (message, illustration, CTA)
3. Verify empty states are helpful (explain why empty + what to do)
4. Check for null/undefined data that renders blank instead of empty state
5. Verify initial/first-use states are welcoming
6. Check filter results when nothing matches

**Output**: Empty state coverage report.

---

## Check 87: Cart Interaction Optimisation

**Goal**: Ensure cart interactions are fast and intuitive.

**Procedure**:
1. Check add-to-cart feedback (animation, counter update, confirmation)
2. Verify quantity adjustment is easy (+ / - buttons, direct input)
3. Check remove-from-cart confirmation (prevent accidental removal)
4. Verify cart persists across navigation
5. Check cart total updates in real-time
6. Verify cart is accessible from any page

**Output**: Cart interaction UX report.

---

## Check 88: Menu Readability Analysis

**Goal**: Ensure menu content is easy to read and scan.

**Procedure**:
1. Check font sizes for menu item names, descriptions, and prices
2. Verify visual hierarchy: name > price > description > allergens
3. Check contrast ratios for all text elements
4. Verify line spacing and paragraph spacing
5. Check image quality and sizing consistency
6. Verify information density is appropriate (not cluttered)

**Output**: Menu readability scorecard.

---

## Check 89: Information Hierarchy Evaluation

**Goal**: Verify the visual hierarchy guides user attention correctly.

**Procedure**:
1. Check heading levels (H1 → H2 → H3) for semantic correctness
2. Verify primary actions are visually prominent
3. Check that critical information (price, total, status) is immediately visible
4. Verify secondary information is accessible but not distracting
5. Check for information overload on any single view
6. Verify progressive disclosure for complex information

**Output**: Information hierarchy assessment per key page.

---

## Check 90: Interaction Friction Analysis

**Goal**: Identify unnecessary friction in user interactions.

**Procedure**:
1. Count taps/clicks required for common tasks
2. Identify unnecessary confirmation dialogs
3. Check for auto-focus on primary inputs
4. Verify form auto-fill support
5. Check for smart defaults that reduce input
6. Identify long forms that could be split or simplified

**Output**: Friction analysis with tap-count reduction suggestions.
