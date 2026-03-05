"use client"

import { ReactNode, useEffect } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import { useCartStore } from "@/store/useCartStore"
import { useStaffStore } from "@/store/useStaffStore"
import { useUIStore } from "@/store/useUIStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"
import { ToastProvider } from "@/components/ui/Toast"
import { ModalProvider } from "@/components/ui/Modal"
import { DemoNarrationOverlay } from "@/components/demo/DemoNarrationOverlay"
import { fetchJson } from "@/lib/fetchJson"

/*
APPLICATION-WIDE PROVIDERS

This file is mounted exactly once by app/layout.tsx.
It establishes all client-side state containers and global UI services.

Key invariant:
- User session = person
- Session identity is per-browser and never reset implicitly.
*/

export function Providers({ children }: { children: ReactNode }) {
  const hydrateSession = useSessionStore(s => s.hydrate)
  const hydrateCart = useCartStore(s => s.hydrate)
  const hydrateStaff = useStaffStore(s => s.hydrate)
  const hydrateUI = useUIStore(s => s.hydrate)
  const setRestaurant = useRestaurantStore(s => s.setRestaurant)

  useEffect(() => {
    /*
      On first client mount:
      - Restore persisted state for the current browser.
      - Hydrate all client-side stores from persisted state.
      - Do NOT create sessions or mutate tables/orders here.
    */
    hydrateSession()
    hydrateCart()
    hydrateStaff()
    hydrateUI()
    fetchJson<{
      restaurant: {
        slug: string
        name: string
        monogram: string
        location: string | null
        assets: {
          logoUrl?: string
          heroUrl?: string
          sectionImageMap?: Record<string, string>
        }
        experienceConfig: {
          menu: {
            heroTitle: string
            heroSubtitle: string
            showMetaStats: boolean
            showPlaceholderNote: boolean
            primaryCtaLabel: string
            primaryCtaHref: string
            secondaryCtaLabel: string
            secondaryCtaHref: string
          }
          review: {
            title: string
            subtitleDineIn: string
            subtitleTakeaway: string
            placeOrderLabel: string
            backLabel: string
            confirmDineIn: string
            confirmTakeaway: string
            showAllergens: boolean
          }
          theme: {
            fontPreset: "SANS" | "SERIF" | "MONO"
            radiusPreset: "SOFT" | "ROUND" | "SHARP"
            customerPrimary: string
            customerSurface: string
            customerText: string
            customerFocus: string
            staffPrimary: string
          }
          launch: {
            isPublished: boolean
          }
          ux: {
            presetId:
              | "FAST_CASUAL_TRUSTED"
              | "FULL_SERVICE_ASSURANCE"
              | "BAR_LOUNGE_SAFE_EXPRESS"
            menuDiscovery:
              | "HERO_FIRST"
              | "SECTION_FIRST"
              | "SEARCH_FIRST"
            ordering:
              | "BOTTOM_SHEET_FAST"
              | "INLINE_STEPPER"
              | "GUIDED_CONFIGURATOR"
            review: "SHEET_REVIEW" | "PAGE_REVIEW"
            checkout:
              | "ONE_PAGE"
              | "GUIDED_SPLIT"
              | "EXPRESS_FIRST"
            engagement:
              | "ALL_IN_ONE"
              | "TASK_TABS"
              | "POST_PURCHASE_PROMPT"
            orderSafetyMode: "STANDARD" | "STRICT"
            checkoutSafetyMode: "STANDARD" | "STRICT"
            socialProofMode:
              | "OFF"
              | "VERIFIED_REVIEWS"
              | "VERIFIED_USAGE"
            tipPresetStrategy:
              | "CONSERVATIVE"
              | "BALANCED"
              | "PREMIUM"
            showProgressAnchors: boolean
            emphasizeSocialProof: boolean
            trustMicrocopy: "MINIMAL" | "BALANCED" | "HIGH_ASSURANCE"
            defaultTipPercent: number
          }
        }
        isDemo: boolean
      }
    }>("/api/tenant/bootstrap", { cache: "no-store" })
      .then(payload => {
        setRestaurant({
          slug: payload.restaurant.slug,
          name: payload.restaurant.name,
          monogram: payload.restaurant.monogram,
          location: payload.restaurant.location,
          assets: payload.restaurant.assets ?? {},
          experienceConfig: payload.restaurant.experienceConfig,
          isDemo: payload.restaurant.isDemo,
        })
      })
      .catch(() => {
        // Preserve default local brand state if tenant endpoint is unavailable.
      })
  }, [
    hydrateSession,
    hydrateCart,
    hydrateStaff,
    hydrateUI,
    setRestaurant,
  ])

  return (
    <ToastProvider>
      <ModalProvider>
        {children}
        <DemoNarrationOverlay />
      </ModalProvider>
    </ToastProvider>
  )
}
