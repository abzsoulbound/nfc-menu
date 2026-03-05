"use client"

import { useCallback, useEffect, useState } from "react"
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
}

async function fetchSimulatorStatus() {
  return fetchJson<DemoSimulatorResponse>(
    "/api/demo/simulator?autostart=1",
    {
      cache: "no-store",
    }
  )
}

export function DemoSimulatorPanel() {
  const [status, setStatus] = useState<DemoSimulatorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await fetchSimulatorStatus()
      setStatus(result.status)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function sync() {
      if (cancelled) return
      await refresh()
    }

    sync().catch(() => {})
    const timer = setInterval(() => {
      sync().catch(() => {})
    }, 4000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  async function runAction(action: "START" | "STOP" | "TICK") {
    setPendingAction(true)
    try {
      const result = await fetchJson<DemoSimulatorResponse>(
        "/api/demo/simulator",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      )
      setStatus(result.status)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPendingAction(false)
    }
  }

  return (
    <Card variant="accent" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          Live Simulator
        </h2>
        <span
          className={`status-chip ${
            status?.enabled
              ? "status-chip-success"
              : "status-chip-neutral"
          }`}
        >
          {status?.enabled ? "Running" : "Stopped"}
        </span>
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

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => runAction("START")}
          disabled={pendingAction}
          variant="primary"
        >
          Start simulator
        </Button>
        <Button
          onClick={() => runAction("TICK")}
          disabled={pendingAction}
          variant="secondary"
        >
          Tick once
        </Button>
        <Button
          onClick={() => runAction("STOP")}
          disabled={pendingAction}
          variant="ghost"
        >
          Stop simulator
        </Button>
      </div>

      <div className="text-xs text-muted">
        Last tick: {status?.lastTickAt ?? "Not yet"}
      </div>

      {error && (
        <div className="status-chip status-chip-danger inline-flex">
          {error}
        </div>
      )}
    </Card>
  )
}
