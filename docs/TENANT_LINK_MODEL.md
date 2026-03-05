# Tenant Link Model

Use tenant-scoped links for every restaurant-facing route.

## Canonical pattern

`/r/{restaurant-slug}?next={path}`

Examples:

- `/r/fable-stores?next=/menu`
- `/r/fable-stores?next=/staff-login`
- `/r/fable-stores?next=/manager`
- `/r/fable-stores?next=/pay/1`

## How routing differentiates restaurants

1. `GET /r/[slug]` validates the slug and sets `restaurant_slug` cookie.
2. App/API requests resolve tenant from:
   - cookie (`restaurant_slug`)
   - custom host subdomain (for mapped domains)
   - default slug fallback
3. The resolved slug selects tenant profile/auth/runtime state.

## Helper APIs

- `restaurantEntryPathForSlug(slug, nextPath)`
- `buildRestaurantScopedLinks(slug)`

Both are in `lib/tenant.ts`.

## Operational rule

Always generate links from `buildRestaurantScopedLinks` or
`restaurantEntryPathForSlug` to avoid cross-tenant drift.
