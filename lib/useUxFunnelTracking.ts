"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"
import {
  assignUxExperimentClient,
  getOrCreateUxSessionId,
  readCachedAssignment,
  trackUxFunnelEventClient,
} from "@/lib/uxClient"

export const DEFAULT_UX_EXPERIMENT_KEY = "customer_funnel_v1"

export function useUxFunnelTracking(input: {
  page: string
  step?: string
  eventName?: string
  metadata?: Record<string, unknown>
  experimentKey?: string
}) {
  const storeSessionId = useSessionStore(s => s.sessionId)
  const setRestaurant = useRestaurantStore(s => s.setRestaurant)
  const [guestSessionId, setGuestSessionId] = useState("")
  const [variantKey, setVariantKey] = useState<string | null>(null)
  const hasTrackedRef = useRef(false)

  const experimentKey =
    input.experimentKey === undefined
      ? DEFAULT_UX_EXPERIMENT_KEY
      : input.experimentKey

  const effectiveSessionId = useMemo(
    () => storeSessionId ?? guestSessionId,
    [guestSessionId, storeSessionId]
  )

  useEffect(() => {
    if (storeSessionId) return
    setGuestSessionId(getOrCreateUxSessionId())
  }, [storeSessionId])

  useEffect(() => {
    if (!effectiveSessionId || !experimentKey) return

    const cached = readCachedAssignment({
      experimentKey,
      sessionId: effectiveSessionId,
    })
    if (cached?.variantKey) {
      setVariantKey(cached.variantKey)
    }

    assignUxExperimentClient({
      sessionId: effectiveSessionId,
      experimentKey,
    })
      .then(assignment => {
        if (assignment?.variantKey) {
          setVariantKey(assignment.variantKey)
        }
        if (assignment?.uxPatch) {
          const current = useRestaurantStore.getState().experienceConfig
          setRestaurant({
            experienceConfig: {
              ...current,
              ux: {
                ...current.ux,
                ...assignment.uxPatch,
              },
            },
          })
        }
      })
      .catch(() => {
        // analytics setup path should never block UI
      })
  }, [effectiveSessionId, experimentKey, setRestaurant])

  useEffect(() => {
    if (!effectiveSessionId) return
    if (hasTrackedRef.current) return

    hasTrackedRef.current = true

    trackUxFunnelEventClient({
      sessionId: effectiveSessionId,
      eventName: input.eventName ?? "page_view",
      page: input.page,
      step: input.step ?? "view",
      experimentKey,
      variantKey: variantKey ?? undefined,
      metadata: input.metadata,
    }).catch(() => {
      // non-blocking analytics path
    })
  }, [
    effectiveSessionId,
    experimentKey,
    input.eventName,
    input.metadata,
    input.page,
    input.step,
    variantKey,
  ])

  return {
    sessionId: effectiveSessionId,
    experimentKey,
    variantKey,
  }
}
