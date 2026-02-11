"use client"

import { useEffect, useMemo, useState } from "react"
import { formatRefreshInterval } from "@/lib/demoMode"

type DemoStatus = {
  demoBypass: boolean
  autoRefreshMs: number
}

export function DemoModeRuntime() {
  const [demoStatus, setDemoStatus] = useState<DemoStatus>({
    demoBypass: false,
    autoRefreshMs: 0,
  })

  useEffect(() => {
    let active = true

    async function loadStatus() {
      try {
        const res = await fetch("/api/staff/auth?role=admin", {
          cache: "no-store",
        })
        if (!res.ok) return

        const payload = (await res.json()) as {
          demoBypass?: unknown
          autoRefreshMs?: unknown
        }
        if (!active) return

        const nextAutoRefreshMs =
          typeof payload?.autoRefreshMs === "number" &&
          Number.isFinite(payload.autoRefreshMs) &&
          payload.autoRefreshMs >= 1000
            ? Math.floor(payload.autoRefreshMs)
            : 0

        setDemoStatus({
          demoBypass: payload?.demoBypass === true,
          autoRefreshMs: nextAutoRefreshMs,
        })
      } catch {
        // best-effort status check only
      }
    }

    void loadStatus()

    return () => {
      active = false
    }
  }, [])

  const bannerText = useMemo(() => {
    if (!demoStatus.demoBypass) return ""
    return `Demo mode active: staff passcodes are temporarily disabled and pages auto-refresh${
      demoStatus.autoRefreshMs > 0
        ? ` every ${formatRefreshInterval(demoStatus.autoRefreshMs)}`
        : ""
    }. Passcodes will be re-enabled before launch.`
  }, [demoStatus.autoRefreshMs, demoStatus.demoBypass])

  useEffect(() => {
    const { demoBypass, autoRefreshMs } = demoStatus
    if (!demoBypass || autoRefreshMs <= 0) return

    const timer = window.setInterval(() => {
      if (document.hidden) return
      window.location.reload()
    }, autoRefreshMs)

    return () => window.clearInterval(timer)
  }, [demoStatus])

  if (!demoStatus.demoBypass) return null

  return (
    <div className="demo-mode-banner" role="status">
      {bannerText}
    </div>
  )
}
