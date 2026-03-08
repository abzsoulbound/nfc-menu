"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { StationQueue } from "@/components/bar/StationQueue"
import { TicketView } from "@/components/bar/TicketView"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import { OrderQueueItemDTO } from "@/lib/types"

type TableGroup = {
  tableNumber: number
  items: OrderQueueItemDTO[]
  submittedAt: string
}

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

function groupByTable(items: OrderQueueItemDTO[]) {
  const grouped: Record<number, TableGroup> = {}

  for (const item of items) {
    if (!grouped[item.tableNumber]) {
      grouped[item.tableNumber] = {
        tableNumber: item.tableNumber,
        items: [],
        submittedAt: item.submittedAt,
      }
    }
    grouped[item.tableNumber].items.push(item)
  }

  return Object.values(grouped).sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() -
      new Date(b.submittedAt).getTime()
  )
}

export default function BarDashboard() {
  const [items, setItems] = useState<OrderQueueItemDTO[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(
    null
  )
  const [queueSearch, setQueueSearch] = useState("")

  const tables = useMemo(() => groupByTable(items), [items])
  const filteredTables = useMemo(() => {
    const query = queueSearch.trim().toLowerCase()
    if (!query) return tables

    return tables.filter(table => {
      const haystack = [
        table.tableNumber === 0 ? "takeaway" : `table ${table.tableNumber}`,
        String(table.items.length),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [queueSearch, tables])
  const activeTableData = useMemo(
    () => tables.find(t => t.tableNumber === activeTable) ?? null,
    [tables, activeTable]
  )
  const preppingLines = items.filter(
    item => item.prepState === "PREPPING"
  ).length
  const waitingLines = items.length - preppingLines
  const takeawayGroups = tables.filter(
    table => table.tableNumber === 0
  ).length
  const oldestQueueMinutes = tables[0]
    ? minutesSince(tables[0].submittedAt)
    : 0

  const fetchQueue = useCallback(async () => {
    const data = await fetchJson<OrderQueueItemDTO[]>(
      "/api/orders?station=BAR",
      {
        cache: "no-store",
      }
    )
    setItems(data)
    const grouped = groupByTable(data)
    const oldest = grouped[0]
    setActiveTable(prev => {
      if (
        prev !== null &&
        grouped.some(table => table.tableNumber === prev)
      ) {
        return prev
      }
      return oldest?.tableNumber ?? null
    })
  }, [])

  useEffect(() => {
    fetchQueue().catch(() => setItems([]))
    const interval = setInterval(() => {
      fetchQueue().catch(() => setItems([]))
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  useRealtimeSync(() => {
    fetchQueue().catch(() => setItems([]))
  })

  async function markBarSent(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        station: "BAR",
      }),
    })
    await fetchQueue()
  }

  async function markBarPreparing(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "START_PREP",
        tableNumber,
        station: "BAR",
      }),
    })
    await fetchQueue()
  }

  async function reprintTicket(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber }),
    })
  }

  async function markBarLinePreparing(
    tableNumber: number,
    lineId: string
  ) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "START_PREP_LINE",
        tableNumber,
        lineId,
        station: "BAR",
      }),
    })
    await fetchQueue()
  }

  async function markBarLineReady(
    tableNumber: number,
    lineId: string
  ) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MARK_READY_LINE",
        tableNumber,
        lineId,
        station: "BAR",
      }),
    })
    await fetchQueue()
  }

  async function voidBarLine(lineId: string, reason: string) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VOID_LINE",
        lineId,
        reason,
      }),
    })
    await fetchQueue()
  }

  async function refireBarLine(
    lineId: string,
    reason: string
  ) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REFIRE_LINE",
        lineId,
        reason,
      }),
    })
    await fetchQueue()
  }

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 top-16 h-44 w-44 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 top-56 h-48 w-48 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[var(--section-border)] bg-[image:var(--section-gradient)]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Bar Station
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Drinks prep and send queue
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(255,255,255,0.86)]">
                Process drink tickets in order, move lines into prep quickly,
                and dispatch without delays to keep service cadence steady.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral">
                  Tickets: {tables.length}
                </span>
                <span className="status-chip status-chip-warning">
                  Waiting lines: {waitingLines}
                </span>
                <span className="status-chip status-chip-success">
                  Prepping lines: {preppingLines}
                </span>
                <span className="status-chip status-chip-neutral">
                  Oldest: {oldestQueueMinutes}m
                </span>
                <span className="status-chip status-chip-neutral">
                  Takeaway: {takeawayGroups}
                </span>
              </div>
            </div>

            <Button
              variant="quiet"
              className="min-h-[44px]"
              onClick={() => fetchQueue().catch(() => setItems([]))}
            >
              Refresh queue
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.45fr]">
          <Card className="space-y-3 border-[rgba(0,18,88,0.34)]">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Bar queue
              </h2>
              <label className="space-y-1 text-xs uppercase tracking-[0.12em] text-muted">
                Search queue
                <input
                  type="text"
                  value={queueSearch}
                  onChange={event => setQueueSearch(event.target.value)}
                  placeholder="table number or takeaway"
                  className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </div>
            <StationQueue
              tables={filteredTables}
              activeTable={activeTable}
              onSelect={setActiveTable}
              onReprint={tableNumber =>
                reprintTicket(tableNumber).catch(() => {})
              }
            />
          </Card>

          <Card className="space-y-3 border-[rgba(0,18,88,0.34)]">
            {activeTableData ? (
              <TicketView
                tableNumber={activeTableData.tableNumber}
                items={activeTableData.items}
                onBack={() => setActiveTable(null)}
                onReprint={() =>
                  reprintTicket(activeTableData.tableNumber).catch(
                    () => {}
                  )
                }
                onStart={() =>
                  markBarPreparing(activeTableData.tableNumber).catch(
                    () => {}
                  )
                }
                onStartLine={lineId =>
                  markBarLinePreparing(
                    activeTableData.tableNumber,
                    lineId
                  ).catch(() => {})
                }
                onReadyLine={lineId =>
                  markBarLineReady(
                    activeTableData.tableNumber,
                    lineId
                  ).catch(() => {})
                }
                onVoidLine={(lineId, reason) =>
                  voidBarLine(lineId, reason).catch(() => {})
                }
                onRefireLine={(lineId, reason) =>
                  refireBarLine(lineId, reason).catch(() => {})
                }
                onComplete={() =>
                  markBarSent(activeTableData.tableNumber).catch(
                    () => {}
                  )
                }
                canStartPrep={activeTableData.items.some(
                  item => item.prepState !== "PREPPING"
                )}
              />
            ) : (
              <div className="py-12 text-center text-sm text-secondary">
                Select a ticket from the queue.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
