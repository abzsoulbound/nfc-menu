"use client"

import { useUxFunnelTracking } from "@/lib/useUxFunnelTracking"

export function UxPageTracker({
  page,
  step = "view",
  eventName = "page_view",
}: {
  page: string
  step?: string
  eventName?: string
}) {
  useUxFunnelTracking({
    page,
    step,
    eventName,
  })
  return null
}