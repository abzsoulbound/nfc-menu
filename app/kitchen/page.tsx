"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { StationQueue } from "@/components/kitchen/StationQueue"
import { TicketView } from "@/components/kitchen/TicketView"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import { OrderQueueItemDTO } from "@/lib/types"

type TableGroup = {
  tableNumber: number
  items: OrderQueueItemDTO[]
  submittedAt: string
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

export default function KitchenDashboard() {
  const [items, setItems] = useState<OrderQueueItemDTO[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(
    null
  )

  const tables = useMemo(() => groupByTable(items), [items])
  const activeTableData = useMemo(
    () => tables.find(t => t.tableNumber === activeTable) ?? null,
    [tables, activeTable]
  )

  const fetchQueue = useCallback(async () => {
    const data = await fetchJson<OrderQueueItemDTO[]>(
      "/api/orders?station=KITCHEN",
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
    }, 4000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  useRealtimeSync(() => {
    fetchQueue().catch(() => setItems([]))
  })

  async function markKitchenSent(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        station: "KITCHEN",
      }),
    })
    await fetchQueue()
  }

  async function markKitchenPreparing(tableNumber: number) {
    await fetchJson("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "START_PREP",
        tableNumber,
        station: "KITCHEN",
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

  async function markKitchenLinePreparing(
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
        station: "KITCHEN",
      }),
    })
    await fetchQueue()
  }

  async function markKitchenLineReady(
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
        station: "KITCHEN",
      }),
    })
    await fetchQueue()
  }

  async function voidKitchenLine(lineId: string, reason: string) {
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

  async function refireKitchenLine(
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
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[0.95fr_1.45fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Kitchen queue
          </h2>
          <StationQueue
            tables={tables}
            activeTable={activeTable}
            onSelect={setActiveTable}
            onReprint={tableNumber =>
              reprintTicket(tableNumber).catch(() => {})
            }
          />
        </Card>

        <Card className="space-y-3">
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
                markKitchenPreparing(activeTableData.tableNumber).catch(
                  () => {}
                )
              }
              onStartLine={lineId =>
                markKitchenLinePreparing(
                  activeTableData.tableNumber,
                  lineId
                ).catch(() => {})
              }
              onReadyLine={lineId =>
                markKitchenLineReady(
                  activeTableData.tableNumber,
                  lineId
                ).catch(() => {})
              }
              onVoidLine={(lineId, reason) =>
                voidKitchenLine(lineId, reason).catch(() => {})
              }
              onRefireLine={(lineId, reason) =>
                refireKitchenLine(lineId, reason).catch(() => {})
              }
              onComplete={() =>
                markKitchenSent(activeTableData.tableNumber).catch(
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
  )
}
