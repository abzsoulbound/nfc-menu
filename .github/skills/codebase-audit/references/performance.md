# Performance (Checks 61–70)

## Check 61: Slow Endpoint Detection

**Goal**: Identify API endpoints likely to have high latency.

**Procedure**:
1. Find endpoints that make multiple sequential database calls
2. Identify endpoints that call external APIs (Stripe) synchronously
3. Check for endpoints with heavy computation (sorting large datasets, aggregations)
4. Look for endpoints that fetch data they don't use
5. Check response payload sizes for over-fetching
6. Identify endpoints without caching that serve static-ish data

**Output**: Ranked list of potentially slow endpoints with root cause analysis.

---

## Check 62: N+1 Query Detection

**Goal**: Find N+1 query patterns that cause excessive database round-trips.

**Procedure**:
1. Search for Prisma queries inside loops (`for`, `map`, `forEach`)
2. Check for `findUnique`/`findFirst` calls inside array iterations
3. Look for missing `include` or `select` that cause lazy loading
4. Identify list endpoints that fetch related data per-item instead of batch
5. Check for sequential `await` calls that could be `Promise.all`
6. Verify `include` is used instead of separate queries for related data

**Output**: N+1 pattern list with batched query alternatives.

---

## Check 63: Database Query Performance Analysis

**Goal**: Identify database queries that may perform poorly at scale.

**Procedure**:
1. Find queries on large tables without WHERE clause filters
2. Check for `findMany` without `take` limits
3. Identify queries that scan full tables (missing indexes)
4. Check for expensive operations: `count` on large tables, `LIKE '%...'`
5. Look for complex nested `include` chains (deep joins)
6. Check for `orderBy` on non-indexed columns

**Output**: Query performance risk assessment with optimisation suggestions.

---

## Check 64: Memory Usage Analysis

**Goal**: Identify code patterns that could cause high memory usage.

**Procedure**:
1. Search for large array accumulations in memory
2. Check for unbounded data fetches (fetching all records into memory)
3. Look for memory leaks: event listeners not removed, intervals not cleared
4. Check for large object cloning/spreading in hot paths
5. Verify Zustand stores don't accumulate unbounded data
6. Check for large static imports that inflate bundle size

**Output**: Memory risk hotspot list with fixes.

---

## Check 65: CPU Usage Hotspots Detection

**Goal**: Find computationally expensive operations.

**Procedure**:
1. Search for nested loops (O(n²) or worse)
2. Check for expensive string operations (regex on large strings, repeated concatenation)
3. Look for synchronous JSON parsing of large payloads
4. Identify heavy client-side computations that block the main thread
5. Check for unnecessary re-computation (missing memoisation)
6. Look for expensive sorting/filtering on large datasets

**Output**: CPU hotspot list with complexity analysis.

---

## Check 66: Network Request Optimisation

**Goal**: Reduce unnecessary network round-trips.

**Procedure**:
1. Identify sequential API calls from client that could be batched
2. Check for redundant fetches (same data fetched multiple times)
3. Look for missing request deduplication
4. Verify prefetching for predictable navigation paths
5. Check for unnecessarily large request/response payloads
6. Verify appropriate use of HTTP caching headers

**Output**: Network optimisation opportunities with implementation suggestions.

---

## Check 67: Caching Opportunities Detection

**Goal**: Identify data that could benefit from caching.

**Procedure**:
1. Find frequently accessed, rarely changing data (menu items, restaurant config)
2. Check for missing `Cache-Control` headers on static responses
3. Identify repeated database queries for the same data
4. Look for opportunities to use Next.js ISR or static generation
5. Check for client-side caching opportunities (SWR, React Query patterns)
6. Verify Runtime state tables are being used effectively as caches

**Output**: Caching opportunity map with implementation recommendations.

---

## Check 68: API Batching Opportunities

**Goal**: Identify API calls that could be combined to reduce latency.

**Procedure**:
1. Find client components that make multiple parallel API calls
2. Identify server routes that could combine related data in one response
3. Check for chatty API patterns (many small requests vs fewer large ones)
4. Look for GraphQL-like use cases (different clients need different fields)
5. Verify aggregate endpoints exist for dashboard/summary views
6. Check for sequential server-to-DB calls that could be batched

**Output**: Batching recommendations with API design suggestions.

---

## Check 69: Render Performance Analysis

**Goal**: Identify React rendering performance issues.

**Procedure**:
1. Search for components that re-render on every parent render (missing memo)
2. Check for expensive computations inside render (missing useMemo)
3. Look for inline function/object creation causing child re-renders
4. Identify large component trees without windowing/virtualisation
5. Check for context providers that trigger broad re-renders
6. Verify Zustand selectors are granular (not selecting entire store)

**Output**: Render performance analysis with React optimisation suggestions.

---

## Check 70: Bundle Size Optimisation

**Goal**: Reduce JavaScript bundle size for faster page loads.

**Procedure**:
1. Check for heavy libraries that could be tree-shaken or replaced
2. Look for dynamic imports on heavy components (missing `next/dynamic`)
3. Identify server-only code that leaked into client bundles
4. Check for large static assets imported as modules
5. Verify code splitting at route boundaries
6. Check for duplicate dependencies in the bundle

**Output**: Bundle size report with reduction strategies.
