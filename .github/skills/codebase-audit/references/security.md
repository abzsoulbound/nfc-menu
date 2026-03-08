# Security (Checks 41–50)

## Check 41: Authentication Flow Analysis

**Goal**: Verify the authentication system is secure and correctly implemented.

**Procedure**:
1. Read `middleware.ts` and `lib/auth.ts` for auth flow
2. Trace the complete login flow from passcode entry to session creation
3. Verify passcode comparison is timing-safe
4. Check session token generation for sufficient entropy
5. Verify auth state is checked on every protected route
6. Check for auth bypass paths (direct API access, missing middleware)

**Output**: Authentication flow diagram with security assessment.

---

## Check 42: Session Management Validation

**Goal**: Ensure sessions are securely created, maintained, and invalidated.

**Procedure**:
1. Review `lib/sessions.ts` for session lifecycle
2. Check session token storage (cookies, headers, localStorage)
3. Verify session expiration and cleanup logic
4. Check for session fixation vulnerabilities
5. Verify session invalidation on logout/role change
6. Check concurrent session handling

**Output**: Session management security report.

---

## Check 43: JWT/Token Handling Analysis

**Goal**: Verify token-based auth is implemented securely.

**Procedure**:
1. Search for JWT or token creation/validation code
2. Check token signing algorithm (avoid `none`, prefer RS256 or HS256)
3. Verify token expiration is enforced
4. Check that tokens include minimal claims (no sensitive data)
5. Verify token refresh mechanism if applicable
6. Check for token leakage in logs, URLs, or error messages

**Output**: Token security audit.

---

## Check 44: Secrets Exposure Detection

**Goal**: Find any hardcoded secrets, API keys, or credentials in the codebase.

**Procedure**:
1. Grep for patterns: `sk_live`, `pk_live`, `password`, `secret`, `apikey`, `token`
2. Check `.env` files are in `.gitignore`
3. Search for base64-encoded strings that could be credentials
4. Check client-side code for server secrets
5. Verify `NEXT_PUBLIC_` prefix is only on truly public env vars
6. Check git history for accidentally committed secrets

**Output**: Secrets exposure report with remediation steps.

---

## Check 45: Environment Variable Misuse Detection

**Goal**: Verify environment variables are correctly scoped and used.

**Procedure**:
1. Read `lib/env.ts` for environment variable handling
2. List all `process.env` accesses across the codebase
3. Verify `NEXT_PUBLIC_*` vars don't contain secrets
4. Check for fallback values that hide missing config
5. Verify required env vars are validated at startup
6. Check for env vars used inconsistently (different names for same thing)

**Output**: Environment variable audit with misuse flags.

---

## Check 46: SQL Injection Detection

**Goal**: Find potential SQL injection vulnerabilities.

**Procedure**:
1. Search for raw SQL queries (`prisma.$queryRaw`, `prisma.$executeRaw`)
2. Check that raw queries use parameterised inputs (tagged template literals)
3. Verify no string concatenation builds SQL queries
4. Check for ORM-bypass patterns
5. Verify any dynamic WHERE clause construction is safe
6. Check for `$queryRawUnsafe` usage

**Output**: SQL injection risk assessment per query.

---

## Check 47: XSS Vulnerability Detection

**Goal**: Find potential cross-site scripting vulnerabilities.

**Procedure**:
1. Search for `dangerouslySetInnerHTML` usage
2. Check for unescaped user input rendered in JSX
3. Verify that URL parameters are sanitised before display
4. Check for reflected XSS in error messages
5. Verify Content-Security-Policy headers
6. Check for DOM manipulation with user-controlled data

**Output**: XSS vulnerability report.

---

## Check 48: CSRF Vulnerability Detection

**Goal**: Verify protection against cross-site request forgery.

**Procedure**:
1. Check for CSRF tokens on state-changing forms
2. Verify `SameSite` cookie attribute is set
3. Check that state-changing operations require POST (not GET)
4. Verify Origin/Referer header validation
5. Check for custom header requirements on API calls
6. Assess CSRF risk for the NFC tag → session flow

**Output**: CSRF protection coverage report.

---

## Check 49: Input Validation Coverage

**Goal**: Verify all user inputs are validated before processing.

**Procedure**:
1. List all input points: API routes, form handlers, URL params, webhook payloads
2. Check each for input validation (type checking, length limits, format validation)
3. Verify validation happens server-side (not only client-side)
4. Check for missing validation on file uploads if applicable
5. Verify numeric inputs are bounds-checked
6. Check for prototype pollution risks in object parsing

**Output**: Input validation coverage matrix.

---

## Check 50: Role-Based Access Control Validation

**Goal**: Verify RBAC is correctly implemented and enforced.

**Procedure**:
1. Review `ROLE_ACCESS` and `ROLE_PERMISSION_MATRIX` in middleware
2. Verify each API route checks the correct role
3. Check for privilege escalation paths
4. Verify role hierarchy is correctly enforced (ADMIN > MANAGER > WAITER etc.)
5. Check that UI elements are hidden AND server-enforced by role
6. Test edge cases: expired sessions, deleted staff, changed roles

**Output**: RBAC enforcement matrix with gaps.
