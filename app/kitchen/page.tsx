"use client"

import { useEffect, useState } from "react"
import { MouseEvent } from "react"
import { StationQueue } from "@/components/kitchen/StationQueue"
import { TicketView } from "@/components/kitchen/TicketView"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"

type KitchenItem = {
  orderId: string
  tableNumber: number
  name: string
  quantity: number
  edits: any
  submittedAt: string
}

type TableGroup = {
  tableNumber: number
  items: KitchenItem[]
  submittedAt: string
}

export default function KitchenDashboard() {
  const [tables, setTables] = useState<TableGroup[]>([])
  const [activeTable, setActiveTable] = useState<number | null>(null)

  async function fetchQueue() {
    const res = await fetch("/api/orders?station=KITCHEN", {
      cache: "no-store",
    })
    const data: KitchenItem[] = await res.json()

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
    fetchQueue()
    const interval = setInterval(fetchQueue, 4000)
    return () => clearInterval(interval)
  }, [])

  async function markKitchenSent(tableNumber: number) {
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        station: "KITCHEN",
      }),
    })

    setActiveTable(null)
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
      <TicketView
        tableNumber={table.tableNumber}
        items={table.items}
        onBack={() => setActiveTable(null)}
        onReprint={() => reprintTicket(table.tableNumber)}
        onComplete={() => markKitchenSent(table.tableNumber)}
      />
    )
  }

  return (
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
                {table.items.length} kitchen item(s)
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
          No kitchen items waiting
        </div>
      )}
    </div>
  )
}
