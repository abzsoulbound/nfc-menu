"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import {
  clampWalkthroughStepIndex,
  DEMO_WALKTHROUGH_PROFILES,
  DEMO_WALKTHROUGH_STORAGE_KEY,
  detectWalkthroughStepIndexFromPathname,
  getDemoWalkthroughProfile,
  type DemoWalkthroughProfileId,
  type DemoWalkthroughState,
} from "@/lib/demoWalkthrough"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { useRestaurantStore } from "@/store/useRestaurantStore"

function parseWalkthroughState(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DemoWalkthroughState>
    if (parsed.enabled !== true) return null
    const profileId = parsed.profileId
    if (
      profileId !== "FIRST_RUN" &&
      profileId !== "RUSH_HOUR" &&
      profileId !== "FULL_STORY"
    ) {
      return null
    }
    const normalizedStep = clampWalkthroughStepIndex(
      profileId,
      Number(parsed.stepIndex ?? 0)
    )
    return {
      enabled: true,
      profileId,
      stepIndex: normalizedStep,
      startedAtIso:
        typeof parsed.startedAtIso === "string"
          ? parsed.startedAtIso
          : new Date().toISOString(),
    } satisfies DemoWalkthroughState
  } catch {
    return null
  }
}

function readWalkthroughState() {
  try {
    return parseWalkthroughState(
      localStorage.getItem(DEMO_WALKTHROUGH_STORAGE_KEY)
    )
  } catch {
    return null
  }
}

function writeWalkthroughState(state: DemoWalkthroughState | null) {
  try {
    if (!state) {
      localStorage.removeItem(DEMO_WALKTHROUGH_STORAGE_KEY)
      return
    }
    localStorage.setItem(
      DEMO_WALKTHROUGH_STORAGE_KEY,
      JSON.stringify(state)
    )
  } catch {
    // Ignore storage write failures.
  }
}

export function DemoNarrationOverlay() {
  const pathname = usePathname()
  const router = useRouter()
  const restaurantSlug = useRestaurantStore(s => s.slug)
  const isDemoRestaurant = useRestaurantStore(s => s.isDemo)
  const [state, setState] = useState<DemoWalkthroughState | null>(
    null
  )
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setState(readWalkthroughState())
  }, [])

  useEffect(() => {
    setDismissed(false)
  }, [pathname])

  useEffect(() => {
    if (!state || !pathname) return

    const detected = detectWalkthroughStepIndexFromPathname({
      profileId: state.profileId,
      pathname,
    })
    if (detected === null || detected === state.stepIndex) {
      return
    }

    const nextState: DemoWalkthroughState = {
      ...state,
      stepIndex: detected,
    }
    setState(nextState)
    writeWalkthroughState(nextState)
  }, [pathname, state])

  const profile = useMemo(() => {
    if (!state) return null
    return getDemoWalkthroughProfile(state.profileId)
  }, [state])

  if (!state || !profile || dismissed || !isDemoRestaurant) {
    return null
  }

  const step = profile.steps[state.stepIndex]
  if (!step) return null

  const previousStepIndex = Math.max(0, state.stepIndex - 1)
  const nextStepIndex = Math.min(
    profile.steps.length - 1,
    state.stepIndex + 1
  )
  const hasPrevious = state.stepIndex > 0
  const hasNext = state.stepIndex < profile.steps.length - 1
  const onExpectedStep = pathname
    .toLowerCase()
    .startsWith(step.matchPrefix.toLowerCase())

  function navigateToStep(profileId: DemoWalkthroughProfileId, stepIndex: number) {
    if (!state) return

    const normalizedStepIndex = clampWalkthroughStepIndex(
      profileId,
      stepIndex
    )
    const nextProfile = DEMO_WALKTHROUGH_PROFILES[profileId]
    const target = nextProfile.steps[normalizedStepIndex]
    if (!target) return

    const nextState: DemoWalkthroughState = {
      ...state,
      profileId,
      stepIndex: normalizedStepIndex,
    }
    setState(nextState)
    writeWalkthroughState(nextState)

    const href = restaurantEntryPathForSlug(
      restaurantSlug,
      target.nextPath
    )
    router.push(href)
  }

  function stopFeedMode() {
    setState(null)
    writeWalkthroughState(null)
  }

  return (
    <aside className="fixed bottom-3 right-3 z-[70] w-[min(95vw,420px)] rounded-2xl border border-[var(--border)] surface-primary p-3 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.6)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Guided Feed Mode
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {profile.label} | Step {state.stepIndex + 1} of{" "}
            {profile.steps.length}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="focus-ring rounded-md px-2 py-1 text-xs text-muted"
        >
          Hide
        </button>
      </div>

      <div className="mt-2 rounded-xl border border-[var(--border)] surface-accent p-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {step.title}
        </div>
        <div className="mt-1 text-xs text-secondary">{step.feed}</div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted">
          Why this matters
        </div>
        <div className="text-xs text-secondary">{step.whyItMatters}</div>
      </div>

      {!onExpectedStep ? (
        <div className="mt-2 rounded-xl border border-[var(--border)] surface-secondary p-2 text-xs text-secondary">
          Current page is outside this step. Use{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            Open Step
          </span>{" "}
          to jump to the guided route.
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!hasPrevious}
          onClick={() =>
            navigateToStep(profile.id, previousStepIndex)
          }
        >
          Previous
        </Button>
        <Button
          variant="primary"
          onClick={() => navigateToStep(profile.id, state.stepIndex)}
        >
          Open Step
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!hasNext}
          onClick={() => navigateToStep(profile.id, nextStepIndex)}
        >
          Next
        </Button>
        <Button variant="ghost" onClick={stopFeedMode}>
          Stop Feed
        </Button>
      </div>
    </aside>
  )
}
