# API & Backend (Checks 21–30)

## Check 21: REST API Validation

**Goal**: Verify API routes follow REST conventions and best practices.

**Procedure**:
1. List all routes under `app/api/` with their HTTP methods
2. Check resource naming (plural nouns, kebab-case)
3. Verify correct HTTP method semantics (GET=read, POST=create, PUT=update, DELETE=remove)
4. Check status code usage (200, 201, 400, 401, 403, 404, 500)
5. Verify idempotent methods are actually idempotent
6. Check for actions disguised as resources (e.g. `/api/doSomething`)

**Output**: Route-by-route compliance report.

---

## Check 22: Endpoint Consistency Checks

**Goal**: Ensure all API endpoints follow consistent patterns.

**Procedure**:
1. Compare request parsing across handlers (are they all using the same pattern?)
2. Check authentication enforcement (are all protected routes actually protected?)
3. Verify response shape consistency (`{ data, error, status }` or similar)
4. Check header handling consistency
5. Verify CORS configuration is uniform
6. Check that all endpoints handle OPTIONS requests if needed

**Output**: Inconsistency list with standardisation recommendations.

---

## Check 23: Request/Response Schema Validation

**Goal**: Verify that all endpoints validate inputs and produce typed outputs.

**Procedure**:
1. Check each POST/PUT endpoint for request body validation
2. Identify endpoints that trust raw `req.body` without validation
3. Verify response types match documented or expected shapes
4. Check for type coercion issues (string IDs vs number IDs)
5. Look for missing required field checks
6. Verify content-type handling (JSON, form data)

**Output**: Per-endpoint validation coverage report.

---

## Check 24: Error Response Standardisation

**Goal**: Ensure all API errors return consistent, informative responses.

**Procedure**:
1. Search for all `NextResponse.json` or `Response` calls with error status codes
2. Check that error responses include: status code, error message, and error code
3. Verify sensitive information is not leaked in error messages
4. Check that 500 errors are generic (don't expose stack traces)
5. Verify error logging accompanies error responses
6. Check for unhandled promise rejections in route handlers

**Output**: Error response audit with standardisation gaps.

---

## Check 25: API Versioning Strategy Review

**Goal**: Evaluate whether the API has a versioning strategy and if it's needed.

**Procedure**:
1. Check for version prefixes in routes (`/api/v1/`, `/api/v2/`)
2. Identify breaking changes in API surface over git history
3. Assess if external consumers exist (mobile apps, third-party integrations)
4. Evaluate if the current URL structure supports future versioning
5. Check for deprecated endpoints still in use
6. Recommend versioning strategy if needed

**Output**: Versioning assessment with recommendation.

---

## Check 26: Pagination Validation

**Goal**: Verify that list endpoints support proper pagination.

**Procedure**:
1. Find all endpoints that return arrays/lists
2. Check for `limit`/`offset` or `cursor`-based pagination parameters
3. Verify default and maximum page sizes are enforced
4. Check that total count or next-page indicators are included
5. Verify pagination works correctly at boundaries (empty results, last page)
6. Check for unbounded queries that could return massive result sets

**Output**: Pagination coverage report per list endpoint.

---

## Check 27: Rate Limiting Strategy Analysis

**Goal**: Assess protection against API abuse through rate limiting.

**Procedure**:
1. Check for rate limiting middleware or headers
2. Identify endpoints most vulnerable to abuse (auth, payment, order creation)
3. Verify Vercel/platform-level rate limiting configuration
4. Check for exponential backoff on failed auth attempts
5. Assess if rate limits are per-IP, per-session, or per-tenant
6. Verify rate limit headers are returned (X-RateLimit-*)

**Output**: Rate limiting coverage map with gap analysis.

---

## Check 28: Idempotency Validation

**Goal**: Ensure critical operations are idempotent to prevent duplicate side effects.

**Procedure**:
1. Identify state-changing endpoints (order creation, payment, session creation)
2. Check for idempotency keys in payment operations
3. Verify duplicate request handling (same request twice = same result)
4. Check for database-level unique constraints that prevent duplicates
5. Verify retry safety for webhook handlers
6. Check order creation for duplicate prevention logic

**Output**: Idempotency audit per critical endpoint.

---

## Check 29: Webhook Handling Validation

**Goal**: Verify webhook endpoints are secure, idempotent, and reliable.

**Procedure**:
1. Find all webhook handler routes
2. Verify signature validation (Stripe webhook signature checking)
3. Check that webhooks are idempotent (re-delivery safe)
4. Verify webhook handlers respond quickly (defer heavy work)
5. Check error handling — failed webhooks should return 500 for retry
6. Verify event type filtering and handling coverage

**Output**: Webhook handler security and reliability report.

---

## Check 30: API Documentation Generation

**Goal**: Generate or validate API documentation for all endpoints.

**Procedure**:
1. List all API routes with methods, parameters, and response shapes
2. Extract request/response types from TypeScript definitions
3. Document authentication requirements per endpoint
4. Note rate limits, pagination, and error codes
5. Generate OpenAPI/Swagger-compatible documentation if feasible
6. Identify undocumented endpoints

**Output**: Complete API documentation or documentation gap report.
