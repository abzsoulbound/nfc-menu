"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { useRestaurantStore } from "@/store/useRestaurantStore"

type SalesMode = "PAUSED" | "GUIDED" | "LUNCH_RUSH" | "FULL_HOUSE"

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

const MODE_CONFIG: Record<
  Exclude<SalesMode, "PAUSED">,
  {
    label: string
    note: string
    burstTicks: number
    cadenceMs: number
    toneClass: string
  }
> = {
  GUIDED: {
    label: "Guided Demo",
    note: "Steady background activity while you explain screens.",
    burstTicks: 1,
    cadenceMs: 2600,
    toneClass:
      "border-[rgba(104,164,237,0.46)] bg-[rgba(29,53,90,0.58)] text-[#d9e7ff]",
  },
  LUNCH_RUSH: {
    label: "Lunch Rush",
    note: "Higher traffic and queue churn for peak-time storytelling.",
    burstTicks: 2,
    cadenceMs: 1350,
    toneClass:
      "border-[rgba(219,184,118,0.54)] bg-[rgba(82,63,26,0.56)] text-[#f0dcae]",
  },
  FULL_HOUSE: {
    label: "Full House",
    note: "Aggressive load to stress-test queue handling in real time.",
    burstTicks: 4,
    cadenceMs: 850,
    toneClass:
      "border-[rgba(230,128,120,0.52)] bg-[rgba(90,36,36,0.56)] text-[#ffd7d2]",
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

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`
}

export function SalesSimulatorShowcase() {
  const restaurantSlug = useRestaurantStore(s => s.slug)
  const [snapshot, setSnapshot] =
    useState<SalesSimulatorSnapshot | null>(null)
  const [mode, setMode] = useState<SalesMode>("GUIDED")
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const automationBusyRef = useRef(false)

  const activeModeConfig = mode === "PAUSED" ? null : MODE_CONFIG[mode]
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
      action: "START" | "STOP" | "BURST" | "RESET",
      options?: { burstTicks?: number; silent?: boolean }
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
            }),
          }
        )
        setSnapshot(result.snapshot)
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
          "/api/sales/simulator?autostart=1&burstTicks=2",
          { cache: "no-store" }
        )
        if (!cancelled) {
          setSnapshot(result.snapshot)
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
    if (mode === "PAUSED") return
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

  const summaryRows = useMemo(() => {
    if (!snapshot) return []
    return [
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
      {
        label: "Avg prep time",
        value: `${snapshot.shift.performance.avgPrepMinutes.toFixed(1)}m`,
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

  return (
    <div className="space-y-4">
      <Card
        variant="elevated"
        className="space-y-4 border-[rgba(121,166,239,0.42)] bg-[linear-gradient(130deg,rgba(8,15,30,0.96),rgba(15,28,52,0.95),rgba(22,40,69,0.93))]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(218,186,125,0.92)]">
              Dedicated Simulator Mode
            </div>
            <h2 className="font-[family:var(--font-display)] text-3xl tracking-tight text-[#f4ecdc] md:text-5xl">
              Live Owner Sales Console
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[rgba(213,228,250,0.86)]">
              Simulate a busy service while you demo guest ordering, kitchen/bar
              throughput, and checkout outcomes. Use this during calls so owners
              can watch real queue movement, not static screenshots.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                snapshot?.status.enabled
                  ? "border-[rgba(119,199,147,0.54)] bg-[rgba(44,92,62,0.56)] text-[#d8f8e3]"
                  : "border-[rgba(170,190,226,0.48)] bg-[rgba(43,58,84,0.54)] text-[#dce9ff]"
              }`}
            >
              {snapshot?.status.enabled ? "Running" : "Paused"}
            </span>
            {activeModeConfig ? (
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${activeModeConfig.toneClass}`}
              >
                {activeModeConfig.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant={mode === "PAUSED" ? "primary" : "secondary"}
            disabled={pendingAction || loading}
            onClick={async () => {
              setMode("PAUSED")
              await runAction("STOP")
            }}
          >
            Pause
          </Button>
          <Button
            variant={mode === "GUIDED" ? "primary" : "secondary"}
            disabled={pendingAction || loading}
            onClick={async () => {
              setMode("GUIDED")
              await runAction("START")
            }}
          >
            Guided
          </Button>
          <Button
            variant={mode === "LUNCH_RUSH" ? "primary" : "secondary"}
            disabled={pendingAction || loading}
            onClick={async () => {
              setMode("LUNCH_RUSH")
              await runAction("START")
            }}
          >
            Lunch Rush
          </Button>
          <Button
            variant={mode === "FULL_HOUSE" ? "primary" : "secondary"}
            disabled={pendingAction || loading}
            onClick={async () => {
              setMode("FULL_HOUSE")
              await runAction("START")
            }}
          >
            Full House
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-[1.1fr_1fr_1.1fr]">
          <Button
            variant="quiet"
            disabled={pendingAction || loading}
            onClick={() => {
              const ticks = mode === "FULL_HOUSE" ? 6 : 3
              return runAction("BURST", { burstTicks: ticks })
            }}
          >
            Burst Now
          </Button>
          <Button
            variant="ghost"
            disabled={pendingAction || loading}
            onClick={() => refresh().catch(() => {})}
          >
            Refresh Snapshot
          </Button>
          <Button
            variant="ghost"
            disabled={pendingAction || loading}
            onClick={async () => {
              setMode("GUIDED")
              await runAction("RESET")
              await runAction("START")
            }}
          >
            Reset Floor
          </Button>
        </div>

        <div className="text-xs text-[rgba(198,216,245,0.78)]">
          Current mode:{" "}
          <span className="font-semibold text-[#eef4ff]">
            {mode === "PAUSED" ? "Paused" : MODE_CONFIG[mode].label}
          </span>
          {activeModeConfig ? ` | ${activeModeConfig.note}` : ""}
        </div>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="space-y-3 border-[rgba(121,166,239,0.34)] bg-[rgba(11,22,42,0.76)]">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(216,186,129,0.92)]">
            Live KPI Board
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {summaryRows.map(row => (
              <div
                key={row.label}
                className="rounded-xl border border-[rgba(121,166,239,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(189,210,244,0.78)]">
                  {row.label}
                </div>
                <div className="mt-1 text-base font-semibold text-[#eef4ff]">
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[rgba(121,166,239,0.3)] bg-[rgba(17,31,55,0.66)] px-3 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(189,210,244,0.78)]">
              Station Pressure
            </div>
            <div className="mt-3 space-y-2">
              {stationRows.map(row => {
                const ratio = Math.max(0, Math.min(1, row.value / maxQueueValue))
                const width = `${Math.max(8, Math.round(ratio * 100))}%`

                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[rgba(204,220,246,0.86)]">
                      <span>{row.label}</span>
                      <span className="font-semibold text-[#edf4ff]">
                        {row.value}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(13,24,42,0.9)]">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(214,179,108,0.96),rgba(120,174,249,0.96))]"
                        style={{ width }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2 text-xs text-[rgba(200,217,243,0.78)] md:grid-cols-2">
            <div>
              Last simulator tick:{" "}
              <span className="font-semibold text-[#eef4ff]">
                {snapshot?.status.lastTickAt ?? "Not yet"}
              </span>
            </div>
            <div>
              Shift generated:{" "}
              <span className="font-semibold text-[#eef4ff]">
                {snapshot?.shift.generatedAt ?? "Not yet"}
              </span>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 border-[rgba(121,166,239,0.34)] bg-[rgba(11,22,42,0.76)]">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(216,186,129,0.92)]">
            Commercial Signals
          </div>
          <div className="grid grid-cols-2 gap-2">
            {growthRows.map(row => (
              <div
                key={row.label}
                className="rounded-xl border border-[rgba(121,166,239,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(189,210,244,0.78)]">
                  {row.label}
                </div>
                <div className="mt-1 text-base font-semibold text-[#eef4ff]">
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[rgba(121,166,239,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-3 text-xs text-[rgba(202,219,245,0.8)]">
            <div className="grid gap-2">
              <div>
                Demo sessions:{" "}
                <span className="font-semibold text-[#eef4ff]">
                  {snapshot?.live.demoSessions ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Open tables:{" "}
                <span className="font-semibold text-[#eef4ff]">
                  {snapshot?.live.openTables ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Locked tables:{" "}
                <span className="font-semibold text-[#eef4ff]">
                  {snapshot?.live.lockedTables ?? (loading ? "..." : 0)}
                </span>
              </div>
              <div>
                Active sessions:{" "}
                <span className="font-semibold text-[#eef4ff]">
                  {snapshot?.live.activeSessions ?? (loading ? "..." : 0)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-3 border-[rgba(121,166,239,0.34)] bg-[rgba(11,22,42,0.76)]">
        <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(216,186,129,0.92)]">
          Demo Flow Links
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.nextPath}
              href={resolveHref(link.nextPath)}
              className="focus-ring rounded-xl border border-[rgba(121,166,239,0.28)] bg-[rgba(22,39,66,0.62)] px-3 py-3 transition-colors hover:bg-[rgba(31,52,84,0.84)]"
            >
              <div className="text-sm font-semibold text-[#eef4ff]">
                {link.label}
              </div>
              <div className="mt-1 text-xs text-[rgba(198,216,245,0.8)]">
                {link.detail}
              </div>
              <div className="mt-2 text-xs text-[rgba(165,189,229,0.8)] mono-font">
                {resolveHref(link.nextPath)}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
