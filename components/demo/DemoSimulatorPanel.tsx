"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"

type DemoSimulatorStatus = {
  enabled: boolean
  lastTickAt: string | null
  queue: {
    kitchen: number
    bar: number
    ready: number
  }
  activeDemoSessions: number
}

type DemoSimulatorResponse = {
  status: DemoSimulatorStatus
  ran: boolean
  changed: boolean
  ticks: number
}

type RefreshOptions = {
  autostart?: boolean
  burstTicks?: number
  signal?: AbortSignal
  force?: boolean
}

async function fetchSimulatorStatus(options?: {
  autostart?: boolean
  burstTicks?: number
  signal?: AbortSignal
}) {
  const params = new URLSearchParams()
  if (options?.autostart) {
    params.set("autostart", "1")
  }
  if (options?.burstTicks && options.burstTicks > 0) {
    params.set("burstTicks", `${Math.floor(options.burstTicks)}`)
  }
  const query = params.toString()
  const path = query ? `/api/demo/simulator?${query}` : "/api/demo/simulator"

  return fetchJson<DemoSimulatorResponse>(path, {
    cache: "no-store",
    signal: options?.signal,
  })
}

type DemoMode = "PAUSED" | "FIRST_RUN" | "RUSH_HOUR" | "FULL_SERVICE"

const MODE_CONFIG: Record<
  Exclude<DemoMode, "PAUSED">,
  {
    label: string
    note: string
    burstTicks: number
    cadenceMs: number
    toneClass: string
  }
> = {
  FIRST_RUN: {
    label: "First Run Through",
    note: "Calm pacing while you narrate the customer journey step by step.",
    burstTicks: 1,
    cadenceMs: 2800,
    toneClass:
      "status-chip-neutral border-[rgba(126,170,240,0.44)] bg-[rgba(30,50,82,0.64)] text-[#dbe9ff]",
  },
  RUSH_HOUR: {
    label: "Rush Hour",
    note: "Higher order pressure to demonstrate live queue movement.",
    burstTicks: 2,
    cadenceMs: 1400,
    toneClass:
      "border-[rgba(214,181,112,0.54)] bg-[rgba(88,66,29,0.64)] text-[#f0ddb4]",
  },
  FULL_SERVICE: {
    label: "Full Service Peak",
    note: "Maximum simulator intensity for stress-test style demos.",
    burstTicks: 4,
    cadenceMs: 900,
    toneClass:
      "border-[rgba(228,130,124,0.54)] bg-[rgba(92,38,38,0.62)] text-[#ffd9d4]",
  },
}

export function DemoSimulatorPanel() {
  const [status, setStatus] = useState<DemoSimulatorStatus | null>(null)
  const [mode, setMode] = useState<DemoMode>("FIRST_RUN")
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRefreshRef = useRef<Promise<void> | null>(null)
  const lastRefreshAtRef = useRef(0)
  const automationBusyRef = useRef(false)

  const refresh = useCallback(async (options?: RefreshOptions) => {
    const now = Date.now()
    const refreshWindowMs = 900
    if (
      options?.force !== true &&
      now - lastRefreshAtRef.current < refreshWindowMs
    ) {
      return
    }
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current
    }

    const request = (async () => {
      try {
        const result = await fetchSimulatorStatus({
          autostart: options?.autostart,
          burstTicks: options?.burstTicks,
          signal: options?.signal,
        })
        setStatus(result.status)
        setError(null)
      } catch (err) {
        if (
          typeof err === "object" &&
          err &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return
        }
        setError((err as Error).message)
      } finally {
        setLoading(false)
        lastRefreshAtRef.current = Date.now()
      }
    })()

    inFlightRefreshRef.current = request
    try {
      await request
    } finally {
      if (inFlightRefreshRef.current === request) {
        inFlightRefreshRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh({
      autostart: true,
      signal: controller.signal,
      force: true,
    }).catch(() => {})

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh({
          signal: controller.signal,
          force: true,
        }).catch(() => {})
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return
      refresh({
        signal: controller.signal,
      }).catch(() => {})
    }, 5500)

    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      )
    }
  }, [refresh])

  const runAction = useCallback(
    async (
      action:
        | "START"
        | "STOP"
        | "TICK"
        | "BURST"
        | "START_AND_BURST"
        | "RESET",
      options?: { burstTicks?: number; silent?: boolean }
    ) => {
      if (!options?.silent) {
        setPendingAction(true)
      }
      try {
        const result = await fetchJson<DemoSimulatorResponse>(
          "/api/demo/simulator",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              burstTicks: options?.burstTicks,
            }),
          }
        )
        setStatus(result.status)
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        if (!options?.silent) {
          setPendingAction(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (mode === "PAUSED") {
      return
    }

    const config = MODE_CONFIG[mode]
    let cancelled = false

    async function cycle() {
      if (cancelled || automationBusyRef.current) return
      automationBusyRef.current = true
      try {
        await runAction("BURST", {
          burstTicks: config.burstTicks,
          silent: true,
        })
      } finally {
        automationBusyRef.current = false
      }
    }

    cycle().catch(() => {})
    const timer = setInterval(() => {
      cycle().catch(() => {})
    }, config.cadenceMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [mode, runAction])

  async function setModeAndStart(nextMode: Exclude<DemoMode, "PAUSED">) {
    setMode(nextMode)
    await runAction("START")
  }

  async function pauseSimulator() {
    setMode("PAUSED")
    try {
      await runAction("STOP")
    } catch {
      // handled by runAction
    }
  }

  const activeModeConfig = mode === "PAUSED" ? null : MODE_CONFIG[mode]

  return (
    <Card variant="accent" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Live Simulator
          </h2>
          <div className="text-xs text-muted">
            Pick a scenario, then open customer/staff pages to present the full
            service flow.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`status-chip ${
              status?.enabled
                ? "status-chip-success"
                : "status-chip-neutral"
            }`}
          >
            {status?.enabled ? "Running" : "Stopped"}
          </span>
          {activeModeConfig ? (
            <span className={`status-chip ${activeModeConfig.toneClass}`}>
              {activeModeConfig.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Demo sessions
          </div>
          <div className="mt-1 text-base font-semibold">
            {status?.activeDemoSessions ?? (loading ? "..." : 0)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Kitchen queue
          </div>
          <div className="mt-1 text-base font-semibold">
            {status?.queue.kitchen ?? (loading ? "..." : 0)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Bar queue
          </div>
          <div className="mt-1 text-base font-semibold">
            {status?.queue.bar ?? (loading ? "..." : 0)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Ready queue
          </div>
          <div className="mt-1 text-base font-semibold">
            {status?.queue.ready ?? (loading ? "..." : 0)}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          onClick={pauseSimulator}
          disabled={pendingAction || loading}
          variant={mode === "PAUSED" ? "primary" : "secondary"}
        >
          Pause
        </Button>
        <Button
          onClick={() => setModeAndStart("FIRST_RUN")}
          disabled={pendingAction || loading}
          variant={mode === "FIRST_RUN" ? "primary" : "secondary"}
        >
          First run
        </Button>
        <Button
          onClick={() => setModeAndStart("RUSH_HOUR")}
          disabled={pendingAction || loading}
          variant={mode === "RUSH_HOUR" ? "primary" : "secondary"}
        >
          Rush hour
        </Button>
        <Button
          onClick={() => setModeAndStart("FULL_SERVICE")}
          disabled={pendingAction || loading}
          variant={mode === "FULL_SERVICE" ? "primary" : "secondary"}
        >
          Full peak
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <Button
          onClick={() => runAction("TICK")}
          disabled={pendingAction || loading}
          variant="secondary"
        >
          Tick once
        </Button>
        <Button
          onClick={() =>
            runAction("BURST", {
              burstTicks:
                mode === "PAUSED"
                  ? 2
                  : MODE_CONFIG[mode].burstTicks + 1,
            })
          }
          disabled={pendingAction || loading}
          variant="quiet"
        >
          Burst now
        </Button>
        <Button
          onClick={() => runAction("RESET")}
          disabled={pendingAction || loading}
          variant="ghost"
        >
          Reset floor
        </Button>
        <Button
          onClick={() => refresh({ force: true }).catch(() => {})}
          disabled={pendingAction || loading}
          variant="ghost"
        >
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2 text-xs text-muted">
        Mode:{" "}
        <span className="font-semibold text-[var(--text-primary)]">
          {mode === "PAUSED" ? "Paused" : MODE_CONFIG[mode].label}
        </span>
        {activeModeConfig ? ` | ${activeModeConfig.note}` : ""}
      </div>

      <div className="text-xs text-muted">
        Last tick: {status?.lastTickAt ?? "Not yet"} | Demo sessions:{" "}
        {status?.activeDemoSessions ?? 0}
      </div>

      {error && (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      )}
    </Card>
  )
}
