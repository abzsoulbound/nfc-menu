"use client"

import { type ReactNode } from "react"
import { useFeatureStore } from "@/store/useFeatureStore"
import type { FeatureKey } from "@/lib/featureFlags"

type FeatureGateProps = {
  /** Single feature key, or array — all must be enabled (AND). */
  feature: FeatureKey | FeatureKey[]
  /** Render when the feature is disabled (optional). */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Conditionally render children based on feature flags.
 *
 * <FeatureGate feature="loyalty">
 *   <LoyaltyWidget />
 * </FeatureGate>
 *
 * <FeatureGate feature={["loyalty", "customerAccounts"]} fallback={<UpgradeBanner />}>
 *   <LoyaltyDashboard />
 * </FeatureGate>
 */
export function FeatureGate({ feature, fallback = null, children }: FeatureGateProps) {
  const features = useFeatureStore(s => s.features)
  const keys = Array.isArray(feature) ? feature : [feature]
  const allEnabled = keys.every(k => !!features[k])
  return <>{allEnabled ? children : fallback}</>
}

type AnyFeatureGateProps = {
  /** Any of these features being enabled will render children (OR). */
  features: FeatureKey[]
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Render children if ANY of the listed features are enabled.
 */
export function AnyFeatureGate({ features: keys, fallback = null, children }: AnyFeatureGateProps) {
  const features = useFeatureStore(s => s.features)
  const anyEnabled = keys.some(k => !!features[k])
  return <>{anyEnabled ? children : fallback}</>
}
