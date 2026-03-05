"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DEMO_WALKTHROUGH_STORAGE_KEY,
  getDemoWalkthroughProfile,
  type DemoWalkthroughProfileId,
  type DemoWalkthroughState,
} from "@/lib/demoWalkthrough"

function resolveProfileFromQuery(
  value: string | null
): DemoWalkthroughProfileId | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "first-run" || normalized === "first_run") {
    return "FIRST_RUN"
  }
  if (normalized === "rush-hour" || normalized === "rush_hour") {
    return "RUSH_HOUR"
  }
  if (
    normalized === "full-story" ||
    normalized === "full_story" ||
    normalized === "full"
  ) {
    return "FULL_STORY"
  }
  return null
}

function writeFeedState(state: DemoWalkthroughState) {
  try {
    localStorage.setItem(
      DEMO_WALKTHROUGH_STORAGE_KEY,
      JSON.stringify(state)
    )
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export function DemoFeedQueryBootstrap() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const appliedRef = useRef(false)

  useEffect(() => {
    if (appliedRef.current) return

    const profileId = resolveProfileFromQuery(
      searchParams.get("feed")
    )
    if (!profileId) return

    appliedRef.current = true
    const state: DemoWalkthroughState = {
      enabled: true,
      profileId,
      stepIndex: 0,
      startedAtIso: new Date().toISOString(),
    }
    writeFeedState(state)

    const autoNext = searchParams.get("autoNext") === "1"
    if (autoNext) {
      const firstStep = getDemoWalkthroughProfile(profileId).steps[0]
      if (firstStep) {
        window.location.assign(firstStep.nextPath)
        return
      }
    }

    router.replace("/demo")
  }, [router, searchParams])

  return null
}
