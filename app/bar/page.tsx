"use client"

import { useEffect, useRef, useState } from "react"
import { MouseEvent } from "react"
import { TicketView } from "@/components/bar/TicketView"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { StaffAuthGate } from "@/components/staff/StaffAuthGate"
import { trackEvent } from "@/lib/analytics"

type BarItem = {
  orderId: string
  orderItemId: string
  tableNumber: number
  name: string
  quantity: number
  edits: any
  submittedAt: string
}

type TableGroup = {
  tableNumber: number
  items: BarItem[]
  submittedAt: string
}

export default function BarDashboard() {
  const [tables, setTables] = useState<TableGroup[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(null)
  const [restaurantId, setRestaurantId] = useState("unknown")
  const lastRequestIdRef = useRef("unknown")

  async function parseArrayResponse<T>(
    res: Response
  ): Promise<T[]> {
    const raw = await res.text()
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  async function fetchQueue() {
    const res = await fetch("/api/orders?station=BAR", {
      cache: "no-store",
    })
    const requestId = res.headers.get("x-request-id")
    if (requestId) {
      lastRequestIdRef.current = requestId
    }
    const data = await parseArrayResponse<BarItem>(res)

    const grouped: Record<number, TableGroup> = {}

    for (const item of data) {
      if (!grouped[item.tableNumber]) {
        grouped[item.tableNumber] = {
          tableNumber: item.tableNumber,
          items: [],
          submittedAt: item.submittedAt,
        }
      }

      grouped[item.tableNumber].items.push(item)
    }

    setTables(
      Object.values(grouped).sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() -
          new Date(b.submittedAt).getTime()
      )
    )
  }

  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        const res = await fetch("/api/restaurant/current", {
          cache: "no-store",
        })
        const requestId = res.headers.get("x-request-id")
        if (requestId) {
          lastRequestIdRef.current = requestId
        }
        if (!res.ok) return
        const payload = await res.json()
        if (
          payload?.restaurant &&
          typeof payload.restaurant.id === "string"
        ) {
          setRestaurantId(payload.restaurant.id)
        }
      } catch {
        // Keep unknown fallback.
      }
    }

    void loadRestaurant()
    fetchQueue()
    // Poll queue every 8 seconds (bar staff can handle 5-10s lag)
    const interval = setInterval(fetchQueue, 8000)
    return () => clearInterval(interval)
  }, [])

  async function markBarSent(tableNumber: number) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        station: "BAR",
      }),
    })
    const requestId = res.headers.get("x-request-id")
    if (requestId) {
      lastRequestIdRef.current = requestId
    }
    if (res.ok) {
      trackEvent("staff_ticket_action", {
        restaurantId,
        requestId: lastRequestIdRef.current,
        station: "BAR",
        action: "table_complete",
        tableNumber,
      })
    }

    setActiveTable(null)
    fetchQueue()
  }

  async function completeBarItem(orderItemId: string) {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderItemId }),
    })
    const requestId = res.headers.get("x-request-id")
    if (requestId) {
      lastRequestIdRef.current = requestId
    }
    if (res.ok) {
      trackEvent("staff_ticket_action", {
        restaurantId,
        requestId: lastRequestIdRef.current,
        station: "BAR",
        action: "item_complete",
        orderItemId,
      })
    }
    fetchQueue()
  }

  async function reprintTicket(tableNumber: number) {
    await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber }),
    })
  }

  if (activeTable !== null) {
    const table = tables.find(t => t.tableNumber === activeTable)
    if (!table) return null

    return (
      <StaffAuthGate>
        <TicketView
          tableNumber={table.tableNumber}
          items={table.items}
          onBack={() => setActiveTable(null)}
          onReprint={() => reprintTicket(table.tableNumber)}
          onComplete={() => markBarSent(table.tableNumber)}
          onCompleteItem={completeBarItem}
        />
      </StaffAuthGate>
    )
  }

  return (
    <StaffAuthGate>
      <div className="p-4 space-y-4">
        {tables.map(table => (
          <Card
            key={table.tableNumber}
            onClick={() => setActiveTable(table.tableNumber)}
            onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
              e.preventDefault()
              reprintTicket(table.tableNumber)
            }}
            className="cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold">
                  Table {table.tableNumber}
                </div>
                <div className="text-sm opacity-70">
                  {table.items.length} bar item(s)
                </div>
              </div>

              <Badge>
                {Math.floor(
                  (Date.now() -
                    new Date(table.submittedAt).getTime()) /
                    60000
                )}
                m
              </Badge>
            </div>
          </Card>
        ))}

        {tables.length === 0 && (
          <div className="opacity-60 text-center">
            No bar items waiting
          </div>
        )}
      </div>
    </StaffAuthGate>
  )
}
