"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { queueUrgencyFromMinutes, queueUrgencyLabel } from "@/lib/ui"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import {
  ReadyQueueItemDTO,
  SessionDTO,
  TableDTO,
  TagDTO,
} from "@/lib/types"

type ReadyGroup = {
  tableNumber: number
  quantity: number
  oldestSubmittedAt: string
}

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

export default function StaffDashboard() {
  const [tags, setTags] = useState<TagDTO[]>([])
  const [tables, setTables] = useState<TableDTO[]>([])
  const [sessions, setSessions] = useState<SessionDTO[]>([])
  const [readyItems, setReadyItems] = useState<
    ReadyQueueItemDTO[]
  >([])

  const fetchAll = useCallback(async () => {
    const [
      tagsResult,
      tablesResult,
      sessionsResult,
      readyResult,
    ] =
      await Promise.allSettled([
        fetchJson<TagDTO[]>("/api/tags", {
          cache: "no-store",
        }),
        fetchJson<TableDTO[]>("/api/tables", {
          cache: "no-store",
        }),
        fetchJson<SessionDTO[]>("/api/sessions", {
          cache: "no-store",
        }),
        fetchJson<ReadyQueueItemDTO[]>(
          "/api/orders?view=ready",
          {
            cache: "no-store",
          }
        ),
      ])

    if (tagsResult.status === "fulfilled") {
      setTags(tagsResult.value)
    }
    if (tablesResult.status === "fulfilled") {
      setTables(tablesResult.value)
    }
    if (sessionsResult.status === "fulfilled") {
      setSessions(sessionsResult.value)
    }
    if (readyResult.status === "fulfilled") {
      setReadyItems(readyResult.value)
    }
  }, [])

  useEffect(() => {
    fetchAll().catch(() => {})
    const interval = setInterval(() => {
      fetchAll().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchAll])

  useRealtimeSync(() => {
    fetchAll().catch(() => {})
  })

  const activeTables = tables.filter(t => !t.closed)
  const unassignedTags = tags.filter(t => t.tableNumber === null)
  const staleSessions = sessions.filter(session => session.stale)
  const lockedTables = activeTables.filter(table => table.locked)
  const readyTotalQuantity = useMemo(() => {
    return readyItems.reduce((sum, item) => sum + item.quantity, 0)
  }, [readyItems])

  const readyByTable = useMemo(() => {
    const grouped: Record<number, ReadyGroup> = {}
    for (const item of readyItems) {
      if (!grouped[item.tableNumber]) {
        grouped[item.tableNumber] = {
          tableNumber: item.tableNumber,
          quantity: 0,
          oldestSubmittedAt: item.submittedAt,
        }
      }
      grouped[item.tableNumber].quantity += item.quantity
      if (
        new Date(item.submittedAt).getTime() <
        new Date(grouped[item.tableNumber].oldestSubmittedAt).getTime()
      ) {
        grouped[item.tableNumber].oldestSubmittedAt = item.submittedAt
      }
    }
    return Object.values(grouped).sort(
      (a, b) =>
        new Date(a.oldestSubmittedAt).getTime() -
        new Date(b.oldestSubmittedAt).getTime()
    )
  }, [readyItems])

  async function markDelivered(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DELIVER",
        tableNumber,
      }),
    })
    await fetchAll()
  }

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 top-12 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-56 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Waiter Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Service command center
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Prioritize ready deliveries, resolve stale sessions, and keep
                table state clean during peak service.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral">
                  Ready lines: {readyTotalQuantity}
                </span>
                <span className="status-chip status-chip-neutral">
                  Locked tables: {lockedTables.length}
                </span>
                <span className="status-chip status-chip-warning">
                  Stale sessions: {staleSessions.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              <Link
                href="/staff/tables"
                className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Tables
              </Link>
              <Link
                href="/staff/tags"
                className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Tags
              </Link>
              <Link
                href="/staff/sessions"
                className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Sessions
              </Link>
              <Button
                variant="quiet"
                className="min-h-[46px] border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] text-[#dce9ff] hover:bg-[rgba(41,67,108,0.92)]"
                onClick={() => fetchAll().catch(() => {})}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card variant="elevated" className="border-[rgba(114,153,225,0.34)]">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Active tables
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {activeTables.length}
            </div>
          </Card>
          <Card variant="elevated" className="border-[rgba(114,153,225,0.34)]">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Ready queue groups
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {readyByTable.length}
            </div>
          </Card>
          <Card variant="elevated" className="border-[rgba(114,153,225,0.34)]">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Unassigned tags
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {unassignedTags.length}
            </div>
          </Card>
          <Card variant="elevated" className="border-[rgba(114,153,225,0.34)]">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Sessions
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {sessions.length}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="space-y-3 border-[rgba(114,153,225,0.34)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                Ready to deliver
              </h2>
              <Badge variant="neutral">
                Oldest first
              </Badge>
            </div>

            <div className="space-y-2">
              {readyByTable.map(table => {
                const age = minutesSince(table.oldestSubmittedAt)
                const urgency = queueUrgencyFromMinutes(age)

                return (
                  <Card
                    key={table.tableNumber}
                    variant="accent"
                    className="border-[rgba(114,153,225,0.3)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">
                          {table.tableNumber === 0
                            ? "Takeaway"
                            : `Table ${table.tableNumber}`}
                        </div>
                        <div className="text-sm text-secondary">
                          {table.quantity} item(s) ready
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            urgency === "critical"
                              ? "danger"
                              : urgency === "watch"
                              ? "warning"
                              : "success"
                          }
                        >
                          {queueUrgencyLabel(urgency)} | {age}m
                        </Badge>

                        <Button
                          variant="primary"
                          className="min-h-[52px]"
                          onClick={() =>
                            markDelivered(table.tableNumber).catch(() => {})
                          }
                        >
                          Mark delivered
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}

              {readyByTable.length === 0 && (
                <div className="py-10 text-center text-sm text-secondary">
                  No ready items.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-3 border-[rgba(114,153,225,0.34)]">
            <h2 className="text-lg font-semibold tracking-tight">
              Unassigned tags
            </h2>
            <div className="space-y-2">
              {unassignedTags.map(tag => (
                <Card
                  key={tag.id}
                  variant="accent"
                  className="border-[rgba(114,153,225,0.3)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="mono-font text-sm font-semibold">
                        {tag.id}
                      </div>
                      <div className="text-xs text-secondary">
                        {tag.activeSessionCount} session(s)
                      </div>
                    </div>
                    <Badge variant="neutral">
                      {minutesSince(tag.lastSeenAt)}m
                    </Badge>
                  </div>
                </Card>
              ))}

              {unassignedTags.length === 0 && (
                <div className="py-6 text-center text-sm text-secondary">
                  No unassigned tags.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
