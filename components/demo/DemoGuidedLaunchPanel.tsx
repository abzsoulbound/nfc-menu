"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import {
  DEMO_WALKTHROUGH_PROFILES,
  DEMO_WALKTHROUGH_STORAGE_KEY,
  type DemoWalkthroughProfileId,
  type DemoWalkthroughState,
} from "@/lib/demoWalkthrough"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { useRestaurantStore } from "@/store/useRestaurantStore"

const PROFILE_ORDER: DemoWalkthroughProfileId[] = [
  "FIRST_RUN",
  "RUSH_HOUR",
  "FULL_STORY",
]

function persistWalkthroughState(state: DemoWalkthroughState) {
  try {
    localStorage.setItem(
      DEMO_WALKTHROUGH_STORAGE_KEY,
      JSON.stringify(state)
    )
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

function clearWalkthroughState() {
  try {
    localStorage.removeItem(DEMO_WALKTHROUGH_STORAGE_KEY)
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

export function DemoGuidedLaunchPanel() {
  const restaurantSlug = useRestaurantStore(s => s.slug)
  const [pendingProfile, setPendingProfile] =
    useState<DemoWalkthroughProfileId | null>(null)

  const profiles = useMemo(
    () => PROFILE_ORDER.map(id => DEMO_WALKTHROUGH_PROFILES[id]),
    []
  )

  function startWalkthrough(profileId: DemoWalkthroughProfileId) {
    const profile = DEMO_WALKTHROUGH_PROFILES[profileId]
    const firstStep = profile.steps[0]
    if (!firstStep) return

    setPendingProfile(profileId)
    persistWalkthroughState({
      enabled: true,
      profileId,
      stepIndex: 0,
      startedAtIso: new Date().toISOString(),
    })

    const href = restaurantEntryPathForSlug(
      restaurantSlug,
      firstStep.nextPath
    )
    window.location.assign(href)
  }

  function stopWalkthrough() {
    clearWalkthroughState()
    setPendingProfile(null)
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">
        Guided Feed Mode
      </h2>
      <p className="text-sm text-secondary">
        Start a guided mode and the app will feed exactly what to notice on
        each page, with next-step navigation and progress.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {profiles.map(profile => (
          <div
            key={profile.id}
            className="rounded-xl border border-[var(--border)] surface-accent p-3"
          >
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {profile.label}
            </div>
            <div className="mt-1 text-xs text-secondary">
              {profile.summary}
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted">
              {profile.steps.length} guided steps
            </div>
            <Button
              className="mt-3 w-full"
              onClick={() => startWalkthrough(profile.id)}
              disabled={pendingProfile !== null}
              variant="primary"
            >
              {pendingProfile === profile.id
                ? "Launching..."
                : "Start feed mode"}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={stopWalkthrough} variant="ghost">
          Stop guided mode
        </Button>
      </div>
    </Card>
  )
}
