/**
 * Server-side feature checks.
 *
 * Use in Server Components and API routes to conditionally
 * render or respond based on restaurant feature flags.
 */

import type { FeatureKey } from "@/lib/featureFlags"
import type { RestaurantProfile } from "@/lib/restaurants"

/** Check if a feature is enabled for a restaurant profile. */
export function hasFeature(
  restaurant: Pick<RestaurantProfile, "resolvedFeatures">,
  feature: FeatureKey
): boolean {
  return restaurant.resolvedFeatures[feature] === true
}

/** Check if ALL listed features are enabled. */
export function hasAllFeatures(
  restaurant: Pick<RestaurantProfile, "resolvedFeatures">,
  features: FeatureKey[]
): boolean {
  return features.every(f => restaurant.resolvedFeatures[f] === true)
}

/** Check if ANY of the listed features are enabled. */
export function hasAnyFeature(
  restaurant: Pick<RestaurantProfile, "resolvedFeatures">,
  features: FeatureKey[]
): boolean {
  return features.some(f => restaurant.resolvedFeatures[f] === true)
}
