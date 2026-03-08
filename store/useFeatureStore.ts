"use client"

import { create } from "zustand"
import type { FeatureKey } from "@/lib/featureFlags"

type FeatureStoreState = {
  features: Record<string, boolean>
  planTier: string
  hydrated: boolean
  setFeatures: (features: Record<string, boolean>, planTier?: string) => void
}

export const useFeatureStore = create<FeatureStoreState>(set => ({
  features: {},
  planTier: "starter",
  hydrated: false,
  setFeatures: (features, planTier) =>
    set(state => ({
      features,
      planTier: planTier ?? state.planTier,
      hydrated: true,
    })),
}))

/** Check whether a single feature is enabled. */
export function useFeature(key: FeatureKey): boolean {
  return useFeatureStore(s => !!s.features[key])
}

/** Check whether ALL of the given features are enabled. */
export function useFeatures(keys: FeatureKey[]): boolean {
  return useFeatureStore(s => keys.every(k => !!s.features[k]))
}

/** Check whether ANY of the given features are enabled. */
export function useAnyFeature(keys: FeatureKey[]): boolean {
  return useFeatureStore(s => keys.some(k => !!s.features[k]))
}

/** Get the full resolved feature map. */
export function useFeatureMap(): Record<string, boolean> {
  return useFeatureStore(s => s.features)
}
