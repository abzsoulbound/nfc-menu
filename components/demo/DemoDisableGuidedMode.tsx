"use client"

import { useEffect } from "react"
import { DEMO_WALKTHROUGH_STORAGE_KEY } from "@/lib/demoWalkthrough"

export function DemoDisableGuidedMode() {
  useEffect(() => {
    try {
      localStorage.removeItem(DEMO_WALKTHROUGH_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  return null
}
