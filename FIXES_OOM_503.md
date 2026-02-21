# OOM and 503 Fixes - Production Stabilization

## Problem Summary
- Neon Postgres OOM errors (53200)
- Vercel 503 errors on `/api/session` and `/api/cart/get`
- Rate limit warnings: 50-60+ cart/get requests per 10 seconds per session
- Request storms overwhelming database connection pool

## Root Causes Identified
1. **No server-side rate limiting** - only warnings, no enforcement
2. **No in-flight request deduplication** - concurrent requests duplicate DB queries
3. **Unbounded queries** - staff sessions endpoint fetched unlimited rows
4. **Missing database index** - staff sessions list needs index on openedAt

## Fixes Applied

### 1. API Rate Limiting (429 Enforcement) ✅
**File:** `app/api/cart/get/route.ts`

- **Enforced 429 rate limit**: Max 2 requests per 2 seconds per session (1 req/sec avg)
- Returns `HTTP 429` with error code `RATE_LIMIT_EXCEEDED` **before** touching database
- Replaces soft warning with hard block to prevent DB overload

```typescript
// BEFORE: Only logged warnings, still hit DB
recordCartGetHit(sessionId, requestId)

// AFTER: Returns 429 before DB query
if (!enforceRateLimit(sessionId, requestId)) {
  return apiErrorResponse({ ..., status: 429 })
}
```

### 2. In-Flight Request Deduplication ✅
**File:** `app/api/cart/get/route.ts`

- **Collapses concurrent requests** for the same sessionId into single DB query
- Uses `Map<sessionId, Promise<Response>>` to share response across duplicate requests
- Automatic cleanup via `.finally()` to prevent memory leaks

```typescript
// Check if request already in-flight for this session
const existingPromise = cartGetInFlightBySession.get(sessionId)
if (existingPromise) {
  console.log('cart_get_dedupe_hit', { sessionId, requestId })
  return existingPromise  // Reuse existing promise
}
```

### 3. Bounded Session Queries ✅
**File:** `app/api/sessions/route.ts`

- **Added `take: 100`** to staff sessions list
- **Changed `include` to `select`** to fetch only required columns
- Prevents unbounded row fetches that could exhaust memory

```typescript
// BEFORE: Unbounded query
const sessions = await prisma.session.findMany({
  where: { restaurantId, status: "ACTIVE" },
  include: { table: true, tag: { include: { assignment: true } } },
})

// AFTER: Bounded with explicit select
const sessions = await prisma.session.findMany({
  where: { restaurantId, status: "ACTIVE" },
  take: 100,  // Max 100 sessions
  select: { id: true, tagId: true, ... },
})
```

### 4. Database Indexes ✅
**File:** `prisma/schema.prisma`

Added composite index for staff sessions query:
```prisma
model Session {
  // ... fields ...
  @@index([restaurantId, status, openedAt(sort: Desc)])
}
```

**Existing indexes (already optimal):**
- `Session`: `[restaurantId, tagId, status, lastActivityAt DESC]` - covers customer session lookup
- `SessionCart`: `[restaurantId, sessionId]` - covers cart queries
- `CartItem`: `[restaurantId, cartId]` - covers cart item fetches

### 5. Connection Pooling ✅
**Verified correct configuration:**

| Component | Env Var | Type | Purpose |
|-----------|---------|------|---------|
| Prisma (runtime) | `DATABASE_URL` | Pooled | API routes (session, cart, orders) |
| Prisma (migrations) | `DATABASE_URL_UNPOOLED` | Direct | `prisma migrate` / `prisma db push` |
| SSE (cart/stream) | `DATABASE_URL_UNPOOLED` | Direct | Long-lived LISTEN/NOTIFY connection |

**Why this is correct:**
- Runtime API uses **pooled connection** (`DATABASE_URL`) for burst request handling
- SSE uses **direct connection** (`DATABASE_URL_UNPOOLED`) because LISTEN/NOTIFY requires persistent connection
- Migrations use **direct connection** to avoid transaction conflicts

## Architecture: No Polling, SSE Real-Time ✅

**Customer pages already use SSE (no polling):**
- `app/order/t/[tagId]/page.tsx` - EventSource for cart updates
- `app/order/t/[tagId]/review/page.tsx` - EventSource for cart review

**Flow:**
```
CartItem change → Trigger fires → pg_notify('cart_updates') 
  → SSE endpoint filters by sessionId → Client EventSource onmessage 
  → fetch('/api/cart/get') once per update
```

**Client-side safeguards:**
- `cartLoadInFlightRef` prevents overlapping cart fetches
- Circuit breaker with exponential backoff on consecutive failures
- Single EventSource per session (no duplicate streams)

## Metrics to Monitor

### Success Indicators
- [ ] cart_get_rate_limit_exceeded logs drop to zero
- [ ] cart_get_dedupe_hit logs indicate successful request collapsing
- [ ] No Prisma errors with "53200" or "out of memory"
- [ ] 503 errors eliminated or < 0.1% of requests

### Vercel Logs
```bash
# Check for rate limit rejections (should be minimal after fixes)
vercel logs --prod | grep "cart_get_rate_limit_exceeded"

# Verify in-flight deduplication working
vercel logs --prod | grep "cart_get_dedupe_hit"

# No more OOM errors
vercel logs --prod | grep "cart_get_db_oom"
```

### Neon Postgres Monitoring
- Connection count: Should stay well under max (default: 100-200 for pooled, 100 for direct)
- Query performance: `/api/sessions` should use `Session_restaurantId_status_openedAt_idx`
- Memory usage: Should stabilize after changes

## Deployment Checklist

- [x] Apply rate limiting to `/api/cart/get`
- [x] Add in-flight deduplication to `/api/cart/get`
- [x] Bound `/api/sessions` query with `take: 100`
- [x] Add database index for `openedAt` ordering
- [ ] **Run `npx prisma db push`** to create new index
- [ ] **Deploy to production:** `vercel --prod`
- [ ] **Monitor logs for 24h** to verify fixes work under load

## Next Steps (If Issues Persist)

1. **Add query timeouts** - Set statement_timeout in Prisma connection string
2. **Implement response caching** - 250-500ms cache for cart/get with same sessionId
3. **Scale Neon plan** - Upgrade to higher connection limits if still hitting pool exhaustion
4. **Add Redis** - Offload session/cart state to Redis for sub-ms reads

## Edge Cases Handled

- **Multiple tabs open**: In-flight deduplication prevents N×concurrent requests
- **Rapid clicks**: Rate limiter returns 429 before DB query
- **SSE reconnects**: Client has exponential backoff, no request storms
- **Staff with 100+ sessions**: Bounded query prevents full table scan

## Testing Commands

```bash
# Test rate limiting (should get 429 after 2 requests in 2s)
for i in {1..5}; do 
  curl -X POST https://nfc-menu.vercel.app/api/cart/get \
    -H 'Content-Type: application/json' \
    -d '{"sessionId":"test-session-id"}' &
done
wait

# Load test (should handle without 503s)
BASE='https://nfc-menu.vercel.app'
SID=$(curl -sS -X POST "$BASE/api/session" -H 'content-type: application/json' \
  --data '{"tagId":"1"}' | sed -n 's/.*"sessionId":"\([^"]*\)".*/\1/p')

for i in {1..30}; do 
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST "$BASE/api/cart/get" \
    -H 'content-type: application/json' \
    --data '{"sessionId":"'"$SID"'"}' &
done
wait | sort | uniq -c
# Expected: All 200s (or 429s, no 503s)
```

## Summary

**Key Changes:**
1. ✅ Rate limiting with 429 enforcement (max 1 req/sec per session)
2. ✅ In-flight deduplication (collapse concurrent cart requests)
3. ✅ Bounded queries (max 100 sessions, explicit selects)
4. ✅ Database index for staff sessions (openedAt DESC)
5. ✅ Verified pooled connection usage for runtime API

**Expected Outcomes:**
- 0 database OOM errors (53200)
- 0 or < 0.1% 503 errors
- 50-60× reduction in cart/get DB queries (from ~60/10s to ~1/2s per session)
- Sub-100ms cart/get response times under normal load
