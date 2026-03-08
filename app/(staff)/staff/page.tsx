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
    <div className="page-container">
      <div
        aria-hidden="true"
        className="decor-orb -left-10 top-12 h-44 w-44 decor-orb-navy"
      />
      <div
        aria-hidden="true"
        className="decor-orb -right-10 top-56 h-52 w-52 decor-orb-navy"
      />

      <div className="page-container-inner space-y-4">
        <Card
          variant="elevated"
          className="section-hero"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--page-text-secondary)]">
                Waiter Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--page-text)] md:text-4xl">
                Service command center
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--page-text-secondary)]">
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
                className="focus-ring action-surface action-button action-button-lg"
              >
                Tables
              </Link>
              <Link
                href="/staff/tags"
                className="focus-ring action-surface action-button action-button-lg"
              >
                Tags
              </Link>
              <Link
                href="/staff/sessions"
                className="focus-ring action-surface action-button action-button-lg"
              >
                Sessions
              </Link>
              <Button
                variant="quiet"
                className="min-h-[46px]"
                onClick={() => fetchAll().catch(() => {})}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card variant="elevated">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Active tables
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {activeTables.length}
            </div>
          </Card>
          <Card variant="elevated">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Ready queue groups
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {readyByTable.length}
            </div>
          </Card>
          <Card variant="elevated">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Unassigned tags
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {unassignedTags.length}
            </div>
          </Card>
          <Card variant="elevated">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">
              Sessions
            </div>
            <div className="mt-1 text-3xl font-semibold">
              {sessions.length}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="space-y-3 border-[rgba(0,18,88,0.34)]">
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

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Unassigned tags
            </h2>
            <div className="space-y-2">
              {unassignedTags.map(tag => (
                <Card
                  key={tag.id}
                  variant="accent"
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
