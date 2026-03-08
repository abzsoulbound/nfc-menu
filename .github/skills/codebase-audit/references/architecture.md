# Architecture (Checks 11–20)

## Check 11: System Architecture Analysis

**Goal**: Evaluate the overall system architecture for clarity, scalability, and maintainability.

**Procedure**:
1. Map the high-level system components (frontend, API layer, database, external services)
2. Identify communication patterns (REST, real-time, webhooks)
3. Evaluate separation of concerns across layers
4. Check for architectural consistency (are similar features structured similarly?)
5. Identify single points of failure
6. Assess scalability constraints

**Output**: Architecture diagram with strengths, weaknesses, and recommendations.

---

## Check 12: Frontend–Backend Separation Validation

**Goal**: Verify clean separation between client and server code.

**Procedure**:
1. Check for server-only code accidentally bundled for the client
2. Verify `"use client"` / `"use server"` directives are correct
3. Ensure secrets (env vars, API keys) never reach client bundles
4. Check that database imports (`prisma`) only appear in server code
5. Verify API boundaries — client talks to server only via API routes or server actions
6. Check for shared types that inadvertently pull in server dependencies

**Output**: List of separation violations with fix recommendations.

---

## Check 13: API Architecture Evaluation

**Goal**: Assess the API layer design for consistency, completeness, and RESTfulness.

**Procedure**:
1. List all API routes under `app/api/`
2. Check HTTP method usage (GET for reads, POST for writes, etc.)
3. Evaluate URL naming conventions (kebab-case, resource-based)
4. Check for consistent request/response shapes
5. Verify error response format consistency
6. Assess API grouping and nesting logic

**Output**: API architecture scorecard with specific violations.

---

## Check 14: Microservice vs Monolith Analysis

**Goal**: Determine if the current monolithic structure is appropriate or if extraction would help.

**Procedure**:
1. Identify distinct bounded contexts (menu, orders, payments, sessions, staff)
2. Map data ownership per context
3. Evaluate coupling between contexts
4. Assess if any context has divergent scaling needs
5. Check for transaction boundaries that cross contexts
6. Evaluate deployment independence needs

**Output**: Analysis with recommendation to keep monolith or extract specific services.

---

## Check 15: Dependency Graph Analysis

**Goal**: Analyse third-party and internal dependency relationships for risk and bloat.

**Procedure**:
1. Parse `package.json` for direct dependencies
2. Identify outdated packages (`npm outdated`)
3. Check for packages with known vulnerabilities (`npm audit`)
4. Identify heavy dependencies that could be replaced with lighter alternatives
5. Check for duplicate packages in the dependency tree
6. Map which internal modules depend on which external packages

**Output**: Dependency risk matrix with upgrade and replacement recommendations.

---

## Check 16: Folder Structure Optimisation

**Goal**: Evaluate whether the folder structure supports discoverability and scalability.

**Procedure**:
1. Map the current folder structure against Next.js App Router conventions
2. Check component co-location (components near their routes vs centralised)
3. Evaluate `lib/` organisation — is it domain-driven or utility-driven?
4. Check for misplaced files (e.g. components in lib/, utils in components/)
5. Assess naming consistency across folders
6. Identify oversized directories that should be split

**Output**: Folder structure recommendations with migration plan.

---

## Check 17: Domain Modelling Analysis

**Goal**: Validate that the domain model accurately represents business concepts.

**Procedure**:
1. Extract domain entities from Prisma schema
2. Map entities to business concepts (Table, Order, Session, NfcTag, etc.)
3. Check for missing domain concepts
4. Identify entities that conflate multiple business concepts
5. Validate relationship cardinalities (1:1, 1:N, M:N)
6. Check for anemic domain models (entities with no behaviour)

**Output**: Domain model diagram with gap analysis.

---

## Check 18: Event Flow Analysis

**Goal**: Trace how events (user actions, webhooks, system events) propagate through the system.

**Procedure**:
1. Identify all event sources (user clicks, API calls, webhooks, cron)
2. Map event handlers and their side effects
3. Check for event ordering dependencies
4. Identify missing event handlers (events that go unhandled)
5. Look at `SystemEvent` table usage and `realtime.ts` patterns
6. Check for event storms (one action triggering cascading events)

**Output**: Event flow diagram with gaps and risks annotated.

---

## Check 19: Data Ownership Validation

**Goal**: Ensure each piece of data has a clear owner and single source of truth.

**Procedure**:
1. For each Prisma model, identify which module reads/writes it
2. Check for models written by multiple modules (shared ownership risk)
3. Verify runtime state tables (`RuntimeTableState`, etc.) are caches, not sources of truth
4. Check for data duplicated across tables without sync mechanism
5. Validate that derived data is recomputed, not stored stale
6. Check session/cart data ownership boundaries

**Output**: Data ownership matrix with violation flags.

---

## Check 20: Service Boundary Analysis

**Goal**: Evaluate internal service boundaries for clean interfaces and minimal coupling.

**Procedure**:
1. Identify logical services: menu, orders, payments, sessions, auth, kitchen, bar
2. Map inter-service dependencies
3. Check that services communicate via well-defined interfaces
4. Identify services that directly access another service's data
5. Evaluate if service boundaries align with team structure
6. Check for cross-cutting concerns (logging, auth) handled consistently

**Output**: Service boundary map with coupling metrics and recommendations.
