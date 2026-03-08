# Reliability (Checks 91–100)

## Check 91: Edge-Case Detection

**Goal**: Identify edge cases that could cause unexpected behaviour.

**Procedure**:
1. Check number handling: zero, negative, very large, NaN, Infinity
2. Check string handling: empty string, very long string, special characters, unicode
3. Check array handling: empty array, single item, very large array
4. Check null/undefined propagation through function chains
5. Check date/time edge cases: midnight, timezone changes, DST
6. Check for boundary conditions in pagination, limits, and ranges

**Output**: Edge case catalogue with risk assessment per module.

---

## Check 92: Network Failure Handling Validation

**Goal**: Verify the app handles network failures gracefully.

**Procedure**:
1. Identify all network calls (API requests, Stripe calls, webhook sends)
2. Check each for error handling (try/catch, .catch, error boundaries)
3. Verify user sees meaningful feedback on network failure
4. Check for timeout handling on long requests
5. Verify critical operations (payments) have retry logic
6. Check that partial failure states are recoverable

**Output**: Network failure handling coverage report.

---

## Check 93: Offline Behaviour Analysis

**Goal**: Assess how the application behaves when offline.

**Procedure**:
1. Check for service worker or offline cache configuration
2. Identify which features degrade gracefully vs break completely
3. Check for offline detection and user notification
4. Verify locally cached data (cart, menu) survives connectivity loss
5. Check for queue/retry mechanism for offline actions
6. Assess if offline support is needed for the use case

**Output**: Offline behaviour assessment.

---

## Check 94: Race Condition Detection

**Goal**: Find potential race conditions in concurrent operations.

**Procedure**:
1. Identify shared mutable state accessed by concurrent handlers
2. Check for time-of-check-to-time-of-use (TOCTOU) bugs
3. Look for concurrent API calls that modify the same resource
4. Check checkout flow for concurrent payment attempts
5. Verify database operations use appropriate locking
6. Check for race conditions in real-time sync updates

**Output**: Race condition risk map with mitigation strategies.

---

## Check 95: Concurrency Issue Detection

**Goal**: Find concurrency-related bugs in async code.

**Procedure**:
1. Search for `async/await` patterns that might execute in unexpected order
2. Check for unhandled promise rejections
3. Look for `Promise.all` with dependent operations (order matters)
4. Identify fire-and-forget async calls (missing await)
5. Check for concurrent writes to the same database row
6. Verify real-time event ordering consistency

**Output**: Concurrency issue list with fix recommendations.

---

## Check 96: Data Consistency Validation

**Goal**: Verify data stays consistent across system components.

**Procedure**:
1. Check that Zustand client state stays in sync with server state
2. Verify runtime state tables are correctly refreshed
3. Check for stale data after mutations (cache invalidation)
4. Verify optimistic updates are rolled back on failure
5. Check for state drift between browser tabs
6. Verify order status consistency across customer and staff views

**Output**: Data consistency risk assessment.

---

## Check 97: Retry Logic Validation

**Goal**: Verify retry mechanisms are correctly implemented.

**Procedure**:
1. Search for retry patterns in the codebase
2. Check for exponential backoff with jitter
3. Verify maximum retry limits are enforced
4. Check that retried operations are idempotent
5. Verify retry state is visible to the user if applicable
6. Check for cascading retries that could amplify load

**Output**: Retry logic audit per retryable operation.

---

## Check 98: Crash Risk Detection

**Goal**: Identify code patterns that could cause application crashes.

**Procedure**:
1. Search for uncaught exceptions in async code
2. Check for missing null checks on nullable data
3. Look for array access without bounds checking
4. Check for type assertion misuse (`as` casts that could fail at runtime)
5. Verify error boundaries exist for React component trees
6. Check `error.tsx` and `not-found.tsx` exist and are functional

**Output**: Crash risk hotspots with severity ranking.

---

## Check 99: State Desynchronisation Detection

**Goal**: Find places where client and server state can diverge.

**Procedure**:
1. Identify all places where client state mirrors server state
2. Check for missing real-time sync subscriptions
3. Verify polling intervals for stale-data-prone views
4. Check for mutations that update client without server confirmation
5. Verify cart state survives page refreshes
6. Check for session state that can become stale

**Output**: Desynchronisation risk map per state domain.

---

## Check 100: Duplicate Order Prevention Validation

**Goal**: Ensure the system prevents duplicate orders from being created.

**Procedure**:
1. Check for duplicate submission prevention on order creation button
2. Verify server-side idempotency on order creation endpoint
3. Check for unique constraints on order identifiers
4. Verify the UI disables the submit button during processing
5. Check for network retry scenarios that could create duplicates
6. Verify the payment → order link prevents orphaned duplicates

**Output**: Duplicate order prevention coverage report.
