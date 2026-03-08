import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  FEATURE_KEYS,
  type FeatureKey,
  type RestaurantFeatureConfig,
  FEATURE_CATALOG,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  featuresByCategory,
  isFeatureAvailableOnPlan,
  validateFeatureDependencies,
  type PlanTier,
} from "@/lib/featureFlags"
import { updateRestaurantFeatureConfig } from "@/lib/restaurants"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

/**
 * GET /api/restaurant/features
 *
 * Returns the resolved feature flags for the current restaurant
 * along with the full catalog for the admin UI.
 */
export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)

      const plan = (restaurant.planTier ?? "starter") as PlanTier
      const warnings = validateFeatureDependencies(restaurant.resolvedFeatures)

      return ok(
        {
          slug: restaurant.slug,
          planTier: plan,
          featureConfig: restaurant.featureConfig,
          resolvedFeatures: restaurant.resolvedFeatures,
          warnings,
          catalog: FEATURE_CATALOG.map(meta => ({
            ...meta,
            enabled: restaurant.resolvedFeatures[meta.key] ?? false,
            availableOnPlan: isFeatureAvailableOnPlan(meta.key, plan),
            overridden: restaurant.featureConfig[meta.key] !== undefined,
          })),
          categories: CATEGORY_ORDER.map(cat => ({
            key: cat,
            label: CATEGORY_LABELS[cat],
          })),
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "FEATURES_READ_FAILED",
        req,
      })
    }
  })
}

/**
 * PATCH /api/restaurant/features
 *
 * Body: { features: Record<FeatureKey, boolean> }
 *
 * Merges the provided feature overrides into the restaurant config.
 */
export async function PATCH(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["ADMIN"], req)

      const body = await readJson<{
        features?: Record<string, boolean>
      }>(req)

      if (!body.features || typeof body.features !== "object") {
        return badRequest("Missing 'features' object in body", 400, {
          code: "INVALID_BODY",
          req,
        })
      }

      // Validate keys
      const validEntries: RestaurantFeatureConfig = {}
      for (const [key, value] of Object.entries(body.features)) {
        if (!FEATURE_KEYS.includes(key as FeatureKey)) continue
        if (typeof value !== "boolean") continue
        validEntries[key as FeatureKey] = value
      }

      const updated = await updateRestaurantFeatureConfig({
        slug: restaurant.slug,
        featureConfig: validEntries,
      })

      const plan = (updated.planTier ?? "starter") as PlanTier
      const warnings = validateFeatureDependencies(updated.resolvedFeatures)

      return ok(
        {
          slug: updated.slug,
          planTier: plan,
          featureConfig: updated.featureConfig,
          resolvedFeatures: updated.resolvedFeatures,
          warnings,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "FEATURES_UPDATE_FAILED",
        req,
      })
    }
  })
}
