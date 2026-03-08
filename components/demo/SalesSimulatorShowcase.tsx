"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { useRestaurantStore } from "@/store/useRestaurantStore"

type SalesScenario = "FIRST_RUN" | "RUSH_HOUR_FOCUS" | "FULL_DAY_AUTOPILOT"

type SalesSimulatorAction =
  | "START"
  | "STOP"
  | "TICK"
  | "STEP"
  | "BURST"
  | "START_AND_BURST"
  | "RESET"
  | "RESET_DAY"
  | "SET_AUTO_MODE"
  | "SET_STEP_MINUTES"
  | "SET_SIMULATED_TIME"

type SalesSimulatorSnapshot = {
  status: {
    enabled: boolean
    lastTickAt: string | null
    queue: {
      kitchen: number
      bar: number
      ready: number
    }
    activeDemoSessions: number
    simulatedMinuteOfDay: number
    simulatedTimeLabel: string
    dayStartMinute: number
    dayEndMinute: number
    stepMinutes: number
    autoMode: boolean
    isRushHour: boolean
    dayComplete: boolean
    rushWindows: Array<{
      startMinute: number
      endMinute: number
      label: string
    }>
  }
  shift: {
    generatedAt: string
    orders: number
    orderLines: number
    totalRevenue: number
    totalVat: number
    byStation: {
      kitchenLines: number
      barLines: number
    }
    performance: {
      avgPrepMinutes: number
      avgReadyToDeliveredMinutes: number
      delayedActiveLines: number
    }
  }
  features: {
    reservations: number
    waitlist: number
    promos: number
    feedback: number
    notifications: number
    loyaltyMembers: number
    deliveryOrders: number
  }
  live: {
    activeSessions: number
    demoSessions: number
    openTables: number
    lockedTables: number
    checkoutReceipts: number
  }
}

type SalesSimulatorResponse = {
  snapshot: SalesSimulatorSnapshot
  ran: boolean
  changed: boolean
  ticks: number
}

const STEP_OPTIONS = [5, 10, 15, 20, 30] as const

const SCENARIO_CONFIG: Record<
  SalesScenario,
  {
    label: string
    note: string
    stepMinutes: number
    cadenceMs: number
    toneClass: string
  }
> = {
  FIRST_RUN: {
    label: "First Run Through",
    note: "Balanced pace for first-call storytelling and clear transitions.",
    stepMinutes: 10,
    cadenceMs: 2300,
    toneClass:
      "border-[rgba(217,174,63,0.3)] bg-[rgba(0,18,88,0.72)] text-white",
  },
  RUSH_HOUR_FOCUS: {
    label: "Rush Hour Focus",
    note: "Tighter time-steps to highlight queue pressure at 11-12 and 14-15.",
    stepMinutes: 5,
    cadenceMs: 1300,
    toneClass:
      "border-[rgba(217,174,63,0.62)] bg-[rgba(217,174,63,0.38)] text-black",
  },
  FULL_DAY_AUTOPILOT: {
    label: "Full Day Autopilot",
    note: "Run the full cafe day from opening to close with auto progression.",
    stepMinutes: 15,
    cadenceMs: 900,
    toneClass:
      "border-[rgba(217,174,63,0.3)] bg-[rgba(0,18,88,0.84)] text-white",
  },
}

const QUICK_LINKS = [
  {
    label: "Customer Menu",
    nextPath: "/menu",
    detail: "Guest browsing and item selection.",
  },
  {
    label: "Waiter View",
    nextPath: "/staff-login?next=/staff",
    detail: "Table operations and service controls.",
  },
  {
    label: "Kitchen Queue",
    nextPath: "/staff-login?next=/kitchen",
    detail: "Prep pipeline under live load.",
  },
  {
    label: "Bar Queue",
    nextPath: "/staff-login?next=/bar",
    detail: "Parallel station management.",
  },
  {
    label: "Manager Console",
    nextPath: "/staff-login?next=/manager",
    detail: "Menu and operations controls.",
  },
  {
    label: "Checkout",
    nextPath: "/pay/1",
    detail: "Guest payment completion flow.",
  },
  {
    label: "Manager Growth",
    nextPath: "/staff-login?next=/manager/features",
    detail: "Demand and revenue levers in one view.",
  },
  {
    label: "Customer Review",
    nextPath: "/order/takeaway",
    detail: "Final order review before checkout.",
  },
] as const

const QUICK_TIME_JUMPS = [
  {
    label: "09:00 Open",
    minute: 9 * 60,
  },
  {
    label: "11:00 Rush",
    minute: 11 * 60,
  },
  {
    label: "14:00 Rush",
    minute: 14 * 60,
  },
  {
    label: "17:00 Close",
    minute: 17 * 60,
  },
] as const

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`
}

function formatMinuteLabel(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`
}

function toProgressPercent(input: {
  minute: number
  start: number
  end: number
}) {
  const span = input.end - input.start
  if (span <= 0) return 0
  const progress = (input.minute - input.start) / span
  return Math.max(0, Math.min(100, Math.round(progress * 1000) / 10))
}

export function SalesSimulatorShowcase() {
  const restaurantSlug = useRestaurantStore(s => s.slug)
  const [snapshot, setSnapshot] =
    useState<SalesSimulatorSnapshot | null>(null)
  const [scenario, setScenario] = useState<SalesScenario>("FIRST_RUN")
  const [stepMinutes, setStepMinutes] = useState<number>(
    SCENARIO_CONFIG.FIRST_RUN.stepMinutes
  )
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const automationBusyRef = useRef(false)

  const activeScenarioConfig = SCENARIO_CONFIG[scenario]
  const resolveHref = useCallback(
    (nextPath: string) =>
      restaurantEntryPathForSlug(restaurantSlug, nextPath),
    [restaurantSlug]
  )

  const refresh = useCallback(async () => {
    try {
      const result = await fetchJson<SalesSimulatorResponse>(
        "/api/sales/simulator",
        { cache: "no-store" }
      )
      setSnapshot(result.snapshot)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runAction = useCallback(
    async (
      action: SalesSimulatorAction,
      options?: {
        burstTicks?: number
        stepMinutes?: number
        autoMode?: boolean
        simulatedMinuteOfDay?: number
        silent?: boolean
      }
    ) => {
      if (!options?.silent) {
        setPendingAction(true)
      }
      try {
        const result = await fetchJson<SalesSimulatorResponse>(
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
        setSnapshot(result.snapshot)
        setStepMinutes(result.snapshot.status.stepMinutes)
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
    let cancelled = false

    async function bootstrap() {
      if (cancelled) return
      try {
        const result = await fetchJson<SalesSimulatorResponse>(
          "/api/sales/simulator?autostart=1&burstTicks=1",
          { cache: "no-store" }
        )
        if (!cancelled) {
          setSnapshot(result.snapshot)
          setStepMinutes(result.snapshot.status.stepMinutes)
          setError(null)
        }
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
    if (!snapshot?.status.autoMode) return
    if (!snapshot.status.enabled) return
    if (snapshot.status.dayComplete) return

    let cancelled = false
    async function cycle() {
      if (cancelled || automationBusyRef.current) return
      automationBusyRef.current = true
      try {
        await runAction("STEP", {
          stepMinutes,
          silent: true,
        })
      } finally {
        automationBusyRef.current = false
      }
    }

    cycle().catch(() => {})
    const timer = setInterval(() => {
      cycle().catch(() => {})
    }, activeScenarioConfig.cadenceMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [
    activeScenarioConfig.cadenceMs,
    runAction,
    snapshot?.status.autoMode,
    snapshot?.status.dayComplete,
    snapshot?.status.enabled,
    stepMinutes,
  ])

  const summaryRows = useMemo(() => {
    if (!snapshot) return []
    return [
      {
        label: "Simulated time",
        value: snapshot.status.simulatedTimeLabel,
      },
      {
        label: "Active sessions",
        value: snapshot.live.activeSessions,
      },
      {
        label: "Demo sessions",
        value: snapshot.live.demoSessions,
      },
      {
        label: "Open tables",
        value: snapshot.live.openTables,
      },
      {
        label: "Receipts issued",
        value: snapshot.live.checkoutReceipts,
      },
      {
        label: "Orders submitted",
        value: snapshot.shift.orders,
      },
      {
        label: "Order lines",
        value: snapshot.shift.orderLines,
      },
      {
        label: "Simulated revenue",
        value: formatCurrency(snapshot.shift.totalRevenue),
      },
    ]
  }, [snapshot])

  const stationRows = useMemo(() => {
    return [
      {
        label: "Kitchen",
        value: snapshot?.status.queue.kitchen ?? 0,
      },
      {
        label: "Bar",
        value: snapshot?.status.queue.bar ?? 0,
      },
      {
        label: "Ready",
        value: snapshot?.status.queue.ready ?? 0,
      },
    ] as const
  }, [snapshot])

  const maxQueueValue = useMemo(() => {
    return Math.max(
      1,
      ...stationRows.map(row => (Number.isFinite(row.value) ? row.value : 0))
    )
  }, [stationRows])

  const growthRows = useMemo(() => {
    if (!snapshot) return []
    return [
      {
        label: "Reservations",
        value: snapshot.features.reservations,
      },
      {
        label: "Waitlist",
        value: snapshot.features.waitlist,
      },
      {
        label: "Promo codes",
        value: snapshot.features.promos,
      },
      {
        label: "Loyalty members",
        value: snapshot.features.loyaltyMembers,
      },
      {
        label: "Delivery orders",
        value: snapshot.features.deliveryOrders,
      },
      {
        label: "Notifications",
        value: snapshot.features.notifications,
      },
    ]
  }, [snapshot])

  const dayProgress = useMemo(() => {
    if (!snapshot) return 0
    return toProgressPercent({
      minute: snapshot.status.simulatedMinuteOfDay,
      start: snapshot.status.dayStartMinute,
      end: snapshot.status.dayEndMinute,
    })
  }, [snapshot])

  return (
    <div className="space-y-4">
      <Card
        variant="elevated"
        className="space-y-4 border-[rgba(0,18,88,0.42)] bg-[linear-gradient(130deg,rgba(8,15,30,0.96),rgba(15,28,52,0.95),rgba(22,40,69,0.93))]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
              09:00 to 17:00 Simulated Day
            </div>
            <h2 className="font-[family:var(--font-display)] text-3xl tracking-tight text-white md:text-5xl">
              Cafe Day Sales Simulator
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-white/85">
              Every click advances virtual time by X minutes. Rush windows are
              modeled at 11:00-12:00 and 14:00-15:00, with optional autopilot
              that walks the full day.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                snapshot?.status.enabled
                  ? "border-[rgba(217,174,63,0.3)] bg-[rgba(0,18,88,0.72)] text-white"
                  : "border-[rgba(217,174,63,0.62)] bg-[rgba(217,174,63,0.38)] text-black"
              }`}
            >
              {snapshot?.status.enabled ? "Running" : "Paused"}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${activeScenarioConfig.toneClass}`}
            >
              {activeScenarioConfig.label}
            </span>
            {snapshot?.status.isRushHour ? (
              <span className="inline-flex rounded-full border border-[rgba(217,174,63,0.62)] bg-[rgba(217,174,63,0.4)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Rush Hour
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[rgba(0,18,88,0.34)] bg-[rgba(17,31,55,0.66)] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-white/80">
            <span>Simulated Timeline</span>
            <span className="font-semibold text-white">
              {snapshot?.status.simulatedTimeLabel ?? "09:00"}
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-[rgba(9,17,31,0.95)]">
            {snapshot?.status.rushWindows.map(window => {
              const left = toProgressPercent({
                minute: window.startMinute,
                start: snapshot.status.dayStartMinute,
                end: snapshot.status.dayEndMinute,
              })
              const right = toProgressPercent({
                minute: window.endMinute,
                start: snapshot.status.dayStartMinute,
                end: snapshot.status.dayEndMinute,
              })
              return (
                <div
                  key={window.label}
                  className="absolute bottom-0 top-0 rounded-full bg-[rgba(217,180,109,0.34)]"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(0, right - left)}%`,
                  }}
                  title={window.label}
                />
              )
            })}
            <div
              className="absolute bottom-0 top-0 rounded-full bg-[linear-gradient(90deg,rgba(0,18,88,0.96),rgba(217,174,63,0.96))]"
              style={{
                width: `${Math.max(2, dayProgress)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/80">
            <span>
              {snapshot
                ? formatMinuteLabel(snapshot.status.dayStartMinute)
                : "09:00"}
            </span>
            <span>11:00 Rush</span>
            <span>14:00 Rush</span>
            <span>
              {snapshot
                ? formatMinuteLabel(snapshot.status.dayEndMinute)
                : "17:00"}
            </span>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {(Object.keys(SCENARIO_CONFIG) as SalesScenario[]).map(key => (
            <Button
              key={key}
              variant={scenario === key ? "primary" : "secondary"}
              disabled={pendingAction || loading}
              onClick={async () => {
                setScenario(key)
                const nextStep = SCENARIO_CONFIG[key].stepMinutes
                setStepMinutes(nextStep)
                await runAction("SET_STEP_MINUTES", {
                  stepMinutes: nextStep,
                })
              }}
            >
              {SCENARIO_CONFIG[key].label}
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="primary"
            disabled={pendingAction || loading}
            onClick={() => runAction("START")}
          >
            Start Day
          </Button>
          <Button
            variant="secondary"
            disabled={pendingAction || loading}
            onClick={() => runAction("STOP")}
          >
            Pause
          </Button>
          <Button
            variant="quiet"
            disabled={
              pendingAction || loading || snapshot?.status.dayComplete
            }
            onClick={() =>
              runAction("STEP", {
                stepMinutes,
              })
            }
          >
            +{stepMinutes} Minutes
          </Button>
          <Button
            variant={
              snapshot?.status.autoMode ? "primary" : "ghost"
            }
            disabled={pendingAction || loading || snapshot?.status.dayComplete}
            onClick={() =>
              runAction("SET_AUTO_MODE", {
                autoMode: !(snapshot?.status.autoMode ?? false),
              })
            }
          >
            {snapshot?.status.autoMode ? "Stop Auto" : "Auto Mode"}
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-[0.9fr_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-xl border border-[rgba(0,18,88,0.32)] bg-[rgba(22,39,66,0.62)] px-3 py-2 text-xs text-[rgba(255,255,255,0.88)]">
            <span className="uppercase tracking-[0.14em] text-[rgba(182,205,241,0.88)]">
              Step
            </span>
            <select
              value={stepMinutes}
              className="action-surface min-h-[36px] flex-1 rounded-md border px-2 text-sm focus:outline-none"
              onChange={event => {
                const next = Number(event.target.value)
                setStepMinutes(next)
                runAction("SET_STEP_MINUTES", {
                  stepMinutes: next,
                  silent: true,
                }).catch(() => {})
              }}
            >
              {STEP_OPTIONS.map(minutes => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            disabled={pendingAction || loading}
            onClick={() => runAction("RESET_DAY")}
          >
            Reset to 09:00
          </Button>
          <Button
            variant="ghost"
            disabled={pendingAction || loading}
            onClick={async () => {
              setScenario("FIRST_RUN")
              setStepMinutes(SCENARIO_CONFIG.FIRST_RUN.stepMinutes)
              await runAction("RESET")
              await runAction("START")
              await runAction("SET_STEP_MINUTES", {
                stepMinutes: SCENARIO_CONFIG.FIRST_RUN.stepMinutes,
              })
            }}
          >
            Reset Floor + Day
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_TIME_JUMPS.map(jump => (
            <Button
              key={jump.label}
              variant="secondary"
              disabled={pendingAction || loading}
              onClick={() =>
                runAction("SET_SIMULATED_TIME", {
                  simulatedMinuteOfDay: jump.minute,
                })
              }
            >
              {jump.label}
            </Button>
          ))}
        </div>

        <div className="text-xs text-white/80">
          Scenario:{" "}
          <span className="font-semibold text-white">
            {activeScenarioConfig.label}
          </span>
          {` | ${activeScenarioConfig.note}`}
          {snapshot?.status.dayComplete
            ? " | Day complete at 17:00."
            : ""}
        </div>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(11,22,42,0.76)]">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
            Live KPI Board
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {summaryRows.map(row => (
              <div
                key={row.label}
                className="rounded-xl border border-[rgba(0,18,88,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/80">
                  {row.label}
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[rgba(0,18,88,0.3)] bg-[rgba(17,31,55,0.66)] px-3 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              Station Pressure
            </div>
            <div className="mt-3 space-y-2">
              {stationRows.map(row => {
                const ratio = Math.max(0, Math.min(1, row.value / maxQueueValue))
                const width = `${Math.max(8, Math.round(ratio * 100))}%`

                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-white/85">
                      <span>{row.label}</span>
                      <span className="font-semibold text-white">
                        {row.value}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(13,24,42,0.9)]">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(217,174,63,0.96),rgba(0,18,88,0.96))]"
                        style={{ width }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2 text-xs text-white/80 md:grid-cols-2">
            <div>
              Last simulator tick:{" "}
              <span className="font-semibold text-white">
                {snapshot?.status.lastTickAt ?? "Not yet"}
              </span>
            </div>
            <div>
              Shift generated:{" "}
              <span className="font-semibold text-white">
                {snapshot?.shift.generatedAt ?? "Not yet"}
              </span>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(11,22,42,0.76)]">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
            Commercial Signals
          </div>
          <div className="grid grid-cols-2 gap-2">
            {growthRows.map(row => (
              <div
                key={row.label}
                className="rounded-xl border border-[rgba(0,18,88,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/80">
                  {row.label}
                </div>
                <div className="mt-1 text-base font-semibold text-white">
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[rgba(0,18,88,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-3 text-xs text-white/80">
            <div className="grid gap-2">
              <div>
                Demo sessions:{" "}
                <span className="font-semibold text-white">
                  {snapshot?.live.demoSessions ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Open tables:{" "}
                <span className="font-semibold text-white">
                  {snapshot?.live.openTables ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Locked tables:{" "}
                <span className="font-semibold text-white">
                  {snapshot?.live.lockedTables ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Active sessions:{" "}
                <span className="font-semibold text-white">
                  {snapshot?.live.activeSessions ?? (loading ? "..." : 0)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(11,22,42,0.76)]">
        <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
          Demo Flow Links
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.nextPath}
              href={resolveHref(link.nextPath)}
              className="focus-ring action-surface action-card action-card-left rounded-xl px-3 py-3"
            >
              <div className="text-sm font-semibold">
                {link.label}
              </div>
              <div className="action-subtle-text mt-1 text-xs">
                {link.detail}
              </div>
              <div className="action-subtle-text mt-2 text-xs mono-font">
                {resolveHref(link.nextPath)}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
