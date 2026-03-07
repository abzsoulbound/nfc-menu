"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { fetchJson } from "@/lib/fetchJson"

type SimulatorSnapshot = {
  status: {
    enabled: boolean
    simulatedMinuteOfDay: number
    simulatedTimeLabel: string
    stepMinutes: number
    autoMode: boolean
    dayComplete: boolean
    queue: {
      kitchen: number
      bar: number
      ready: number
    }
  }
  shift: {
    orders: number
    totalRevenue: number
  }
  live: {
    activeSessions: number
    checkoutReceipts: number
  }
}

type SimulatorResponse = {
  snapshot: SimulatorSnapshot
}

type SimulatorAction =
  | "START"
  | "STOP"
  | "STEP"
  | "BURST"
  | "RESET"
  | "RESET_DAY"
  | "SET_AUTO_MODE"
  | "SET_STEP_MINUTES"
  | "SET_SIMULATED_TIME"

function money(value: number) {
  return `£${value.toFixed(0)}`
}

export function DemoControlSimulator({
  sectionLabel = "Sales Simulator",
}: {
  sectionLabel?: string
}) {
  const [snapshot, setSnapshot] = useState<SimulatorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoBusyRef = useRef(false)

  const stepMinutes = snapshot?.status.stepMinutes ?? 10

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchJson<SimulatorResponse>(
        "/api/sales/simulator",
        { cache: "no-store" }
      )
      setSnapshot(payload.snapshot)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runAction = useCallback(
    async (
      action: SimulatorAction,
      options?: {
        burstTicks?: number
        stepMinutes?: number
        autoMode?: boolean
        simulatedMinuteOfDay?: number
        silent?: boolean
      }
    ) => {
      if (!options?.silent) {
        setBusy(true)
      }
      try {
        const payload = await fetchJson<SimulatorResponse>(
          "/api/sales/simulator",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              burstTicks: options?.burstTicks,
              stepMinutes: options?.stepMinutes,
              autoMode: options?.autoMode,
              simulatedMinuteOfDay: options?.simulatedMinuteOfDay,
            }),
          }
        )
        setSnapshot(payload.snapshot)
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        if (!options?.silent) {
          setBusy(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const payload = await fetchJson<SimulatorResponse>(
          "/api/sales/simulator?autostart=1&burstTicks=1",
          { cache: "no-store" }
        )
        if (cancelled) return
        setSnapshot(payload.snapshot)
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap().catch(() => {})
    const timer = setInterval(() => {
      refresh().catch(() => {})
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  useEffect(() => {
    if (!snapshot?.status.enabled) return
    if (!snapshot.status.autoMode) return
    if (snapshot.status.dayComplete) return

    let cancelled = false
    async function cycle() {
      if (cancelled || autoBusyRef.current) return
      autoBusyRef.current = true
      try {
        await runAction("STEP", {
          stepMinutes,
          silent: true,
        })
      } finally {
        autoBusyRef.current = false
      }
    }

    cycle().catch(() => {})
    const timer = setInterval(() => {
      cycle().catch(() => {})
    }, 1200)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [
    runAction,
    snapshot?.status.autoMode,
    snapshot?.status.dayComplete,
    snapshot?.status.enabled,
    stepMinutes,
  ])

  const stats = useMemo(() => {
    return {
      time: snapshot?.status.simulatedTimeLabel ?? "--:--",
      kitchen: snapshot?.status.queue.kitchen ?? 0,
      bar: snapshot?.status.queue.bar ?? 0,
      ready: snapshot?.status.queue.ready ?? 0,
      orders: snapshot?.shift.orders ?? 0,
      revenue: money(snapshot?.shift.totalRevenue ?? 0),
      sessions: snapshot?.live.activeSessions ?? 0,
      receipts: snapshot?.live.checkoutReceipts ?? 0,
    }
  }, [snapshot])

  async function presetFirst() {
    setBusy(true)
    try {
      await runAction("RESET_DAY", { silent: true })
      await runAction("SET_STEP_MINUTES", {
        stepMinutes: 10,
        silent: true,
      })
      await runAction("SET_AUTO_MODE", {
        autoMode: false,
        silent: true,
      })
      await runAction("START", { silent: true })
      await runAction("BURST", { burstTicks: 1, silent: true })
    } finally {
      setBusy(false)
    }
  }

  async function presetRush() {
    setBusy(true)
    try {
      await runAction("SET_SIMULATED_TIME", {
        simulatedMinuteOfDay: 11 * 60,
        silent: true,
      })
      await runAction("SET_STEP_MINUTES", {
        stepMinutes: 5,
        silent: true,
      })
      await runAction("SET_AUTO_MODE", {
        autoMode: false,
        silent: true,
      })
      await runAction("START", { silent: true })
      await runAction("BURST", { burstTicks: 3, silent: true })
    } finally {
      setBusy(false)
    }
  }

  async function presetFull() {
    setBusy(true)
    try {
      await runAction("RESET_DAY", { silent: true })
      await runAction("SET_STEP_MINUTES", {
        stepMinutes: 15,
        silent: true,
      })
      await runAction("START", { silent: true })
      await runAction("SET_AUTO_MODE", {
        autoMode: true,
        silent: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(229,170,20,0.7)]">
          {sectionLabel}
        </span>
        <span className="h-px flex-1 bg-[rgba(229,170,20,0.2)]" />
        {snapshot?.status.enabled && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
            snapshot.status.autoMode
              ? "bg-[rgba(109,200,130,0.15)] text-[#6dc882]"
              : "bg-[rgba(229,170,20,0.15)] text-[#e5aa14]"
          }`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${
              snapshot.status.autoMode ? "bg-[#6dc882] animate-pulse" : "bg-[#e5aa14]"
            }`} />
            {snapshot.status.autoMode ? "Auto-running" : "Running"}
          </span>
        )}
      </div>

      {/* ── Live stats ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "Time", value: stats.time, accent: true },
          { label: "Kitchen", value: stats.kitchen },
          { label: "Bar", value: stats.bar },
          { label: "Ready", value: stats.ready },
          { label: "Orders", value: stats.orders },
          { label: "Revenue", value: stats.revenue, accent: true },
          { label: "Sessions", value: stats.sessions },
          { label: "Receipts", value: stats.receipts },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-3 py-3 text-center transition-colors duration-200 hover:border-[rgba(229,170,20,0.35)]"
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.55)]">
              {stat.label}
            </div>
            <div className={`mono-font mt-1 text-lg font-semibold tabular-nums ${
              stat.accent ? "text-[#e5aa14]" : "text-white"
            }`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Scenario presets ── */}
      <div className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.55)]">
          Scenario Presets
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => presetFirst().catch(() => {})}
            className="focus-ring group flex flex-col items-center gap-0.5 rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3 transition-all duration-200 hover:border-[rgba(229,170,20,0.44)] hover:bg-[rgba(6,12,24,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-white">First Orders</span>
            <span className="text-[10px] text-[rgba(229,170,20,0.55)]">Open + 1 tick</span>
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => presetRush().catch(() => {})}
            className="focus-ring group flex flex-col items-center gap-0.5 rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3 transition-all duration-200 hover:border-[rgba(229,170,20,0.44)] hover:bg-[rgba(6,12,24,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-white">Rush Hour</span>
            <span className="text-[10px] text-[rgba(229,170,20,0.55)]">11am burst</span>
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => presetFull().catch(() => {})}
            className="focus-ring group flex flex-col items-center gap-0.5 rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3 transition-all duration-200 hover:border-[rgba(229,170,20,0.44)] hover:bg-[rgba(6,12,24,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-white">Full Day</span>
            <span className="text-[10px] text-[rgba(229,170,20,0.55)]">Auto entire day</span>
          </button>
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.55)]">
          Playback
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
          <Button
            variant="primary"
            disabled={busy || loading}
            onClick={() => runAction("START").catch(() => {})}
          >
            Start
          </Button>
          <Button
            variant="secondary"
            disabled={busy || loading}
            onClick={() => runAction("STOP").catch(() => {})}
          >
            Pause
          </Button>
          <Button
            variant="quiet"
            disabled={busy || loading || snapshot?.status.dayComplete}
            onClick={() =>
              runAction("STEP", { stepMinutes }).catch(() => {})
            }
          >
            +{stepMinutes}m
          </Button>
          <Button
            variant="quiet"
            disabled={busy || loading || snapshot?.status.dayComplete}
            onClick={() =>
              runAction("BURST", { burstTicks: 3 }).catch(() => {})
            }
          >
            Burst
          </Button>
          <Button
            variant={snapshot?.status.autoMode ? "primary" : "ghost"}
            disabled={busy || loading || snapshot?.status.dayComplete}
            onClick={() =>
              runAction("SET_AUTO_MODE", {
                autoMode: !(snapshot?.status.autoMode ?? false),
              }).catch(() => {})
            }
          >
            {snapshot?.status.autoMode ? "Auto ●" : "Auto"}
          </Button>
        </div>
      </div>

      {/* ── Time jump & reset ── */}
      <div className="flex flex-wrap gap-2.5">
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.55)]">
            Jump to
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "09:00", min: 9 * 60 },
              { label: "11:00", min: 11 * 60 },
              { label: "14:00", min: 14 * 60 },
            ].map(t => (
              <button
                key={t.label}
                type="button"
                disabled={busy || loading}
                onClick={() =>
                  runAction("SET_SIMULATED_TIME", {
                    simulatedMinuteOfDay: t.min,
                  }).catch(() => {})
                }
                className="focus-ring mono-font rounded-lg border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.45)] px-3 py-1.5 text-xs font-medium tabular-nums text-[rgba(229,170,20,0.8)] transition-all duration-150 hover:border-[rgba(229,170,20,0.38)] hover:text-[#e5aa14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.55)]">
            Reset
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => runAction("RESET_DAY").catch(() => {})}
              className="focus-ring rounded-lg border border-[rgba(220,120,120,0.22)] bg-[rgba(40,16,16,0.4)] px-3 py-1.5 text-xs font-medium text-[rgba(240,160,160,0.8)] transition-all duration-150 hover:border-[rgba(220,120,120,0.44)] hover:text-[#f0a0a0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset Day
            </button>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => runAction("RESET").catch(() => {})}
              className="focus-ring rounded-lg border border-[rgba(220,120,120,0.22)] bg-[rgba(40,16,16,0.4)] px-3 py-1.5 text-xs font-medium text-[rgba(240,160,160,0.8)] transition-all duration-150 hover:border-[rgba(220,120,120,0.44)] hover:text-[#f0a0a0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      ) : null}
    </section>
  )
}
