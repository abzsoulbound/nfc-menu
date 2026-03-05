"use client"

import { create } from "zustand"
import type {
  BrandAssetSlots,
  CustomerExperienceConfig,
} from "@/lib/types"
import { DEFAULT_CUSTOMER_EXPERIENCE_CONFIG } from "@/lib/customerExperience"

export type RestaurantClientState = {
  slug: string
  name: string
  monogram: string
  location: string | null
  assets: BrandAssetSlots
  experienceConfig: CustomerExperienceConfig
  isDemo: boolean
}

type RestaurantStoreState = RestaurantClientState & {
  hydrated: boolean
  setRestaurant: (input: Partial<RestaurantClientState>) => void
}

const DEFAULT_RESTAURANT: RestaurantClientState = {
  slug: "demo-template",
  name: "Restaurant Template",
  monogram: "RT",
  location: null,
  assets: {},
  experienceConfig: DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
  isDemo: true,
}

export const useRestaurantStore = create<RestaurantStoreState>(
  set => ({
    ...DEFAULT_RESTAURANT,
    hydrated: false,
    setRestaurant: input =>
      set(state => ({
        ...state,
        ...input,
        assets: {
          ...state.assets,
          ...(input.assets ?? {}),
        },
        experienceConfig: input.experienceConfig
          ? {
              ...state.experienceConfig,
              ...input.experienceConfig,
              menu: {
                ...state.experienceConfig.menu,
                ...input.experienceConfig.menu,
              },
              review: {
                ...state.experienceConfig.review,
                ...input.experienceConfig.review,
              },
              theme: {
                ...state.experienceConfig.theme,
                ...input.experienceConfig.theme,
              },
              launch: {
                ...state.experienceConfig.launch,
                ...input.experienceConfig.launch,
              },
              ux: {
                ...state.experienceConfig.ux,
                ...input.experienceConfig.ux,
              },
            }
          : state.experienceConfig,
        hydrated: true,
      })),
  })
)
