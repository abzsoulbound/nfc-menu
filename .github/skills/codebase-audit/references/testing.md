# Testing (Checks 101–110)

## Check 101: Unit Test Generation

**Goal**: Generate unit tests for core business logic.

**Procedure**:
1. Identify pure functions in `lib/` (pricing, allergens, validation, formatting)
2. For each function, determine inputs, outputs, and edge cases
3. Generate Vitest test files with `describe`/`it` blocks
4. Cover: happy path, edge cases, error cases, boundary values
5. Use proper assertions (toEqual, toThrow, toBeDefined)
6. Place tests adjacent to source or in `tests/unit/`

**Output**: Generated test files ready to run with `vitest`.

---

## Check 102: Integration Test Generation

**Goal**: Generate integration tests for API routes and database operations.

**Procedure**:
1. Identify API routes that interact with the database
2. For each route, generate tests that exercise the full request → response cycle
3. Include database setup/teardown in tests
4. Test authentication enforcement
5. Test validation error responses
6. Verify database state after each operation

**Output**: Integration test files for key API routes.

---

## Check 103: End-to-End Test Generation

**Goal**: Generate Playwright E2E tests for critical user flows.

**Procedure**:
1. Identify critical user flows: NFC scan → menu → order → pay → confirm
2. Generate Playwright test files with `test.describe` blocks
3. Include page navigation, form filling, and assertion steps
4. Test happy path and key error scenarios
5. Include visual regression checks where appropriate
6. Reference `playwright.config.ts` for configuration

**Output**: Playwright test files for critical flows.

---

## Check 104: Mock Generation

**Goal**: Generate test mocks for external dependencies.

**Procedure**:
1. Identify external dependencies: Prisma, Stripe, fetch calls
2. Generate mock implementations that match real interfaces
3. Create mock factories for common data shapes (Order, Session, Table)
4. Include helper functions for setting up mock state
5. Ensure mocks are typed correctly (TypeScript)
6. Place mocks in `tests/mocks/` or `__mocks__/`

**Output**: Mock files for key external dependencies.

---

## Check 105: Test Coverage Analysis

**Goal**: Analyse current test coverage and identify gaps.

**Procedure**:
1. Run existing tests and collect coverage report
2. Identify files with 0% coverage
3. Map coverage by domain (auth, payments, orders, menu)
4. Identify critical code paths without test coverage
5. Prioritise coverage gaps by risk (payment code > UI helper)
6. Recommend minimum coverage targets per domain

**Output**: Coverage report with prioritised gap list.

---

## Check 106: Edge-Case Test Suggestions

**Goal**: Identify edge cases that should have dedicated tests.

**Procedure**:
1. For each key function, enumerate input edge cases
2. Check for timezone-sensitive operations (need TZ tests)
3. Identify concurrent operation scenarios to test
4. List boundary value tests (max quantity, min price, etc.)
5. Identify error recovery scenarios to test
6. Check for locale-sensitive operations

**Output**: Edge case test suggestion list per module.

---

## Check 107: Regression Test Detection

**Goal**: Identify areas prone to regressions and ensure protection.

**Procedure**:
1. Review recent git history for bug-fix commits
2. Check if each bug fix has an accompanying test
3. Identify frequently changed files (high churn = regression risk)
4. Check for commented-out tests or skipped tests
5. Identify integration points most likely to break
6. Verify critical business logic has regression tests

**Output**: Regression risk map with test gap flags.

---

## Check 108: Snapshot Test Suggestions

**Goal**: Identify components that benefit from snapshot testing.

**Procedure**:
1. Identify UI components with complex render output
2. Check for components that render differently based on props/state
3. Identify components where visual changes should be reviewed
4. Recommend inline snapshots vs file snapshots
5. Identify components where snapshot tests would be brittle (skip those)
6. Generate initial snapshot test files

**Output**: Snapshot test recommendations with generated test stubs.

---

## Check 109: API Test Generation

**Goal**: Generate comprehensive API handler tests.

**Procedure**:
1. List all API routes with their methods
2. For each endpoint generate tests: valid request, invalid input, auth failure, server error
3. Test request body validation
4. Test response status codes and shapes
5. Test idempotency where applicable
6. Generate test helpers for authenticated requests

**Output**: API test files covering all endpoints.

---

## Check 110: UI Interaction Tests

**Goal**: Generate tests for complex UI interactions.

**Procedure**:
1. Identify interactive components (cart, menu selector, payment form)
2. Generate tests for: click, type, select, drag, scroll interactions
3. Test keyboard navigation
4. Test loading and error states
5. Verify component state updates after interactions
6. Test accessibility (focus management, ARIA updates)

**Output**: UI interaction test files.
