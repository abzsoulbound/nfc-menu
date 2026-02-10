"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Badge } from "@/components/ui/Badge"

type Item = {
  name: string
  quantity: number
  edits: any
  submittedAt: string
}

type OrderGroup = {
  orderId: string
  submittedAt: string
  items: Item[]
}

type TableView = {
  tableNumber: number
  firstSubmittedAt: string
  initialOrders: OrderGroup[]
  addonOrders: OrderGroup[]
}

export default function TableReviewPage({
  params,
}: {
  params: { tableNumber: string }
}) {
  const tableNumber = Number(params.tableNumber)

  const [data, setData] = useState<TableView | null>(null)

  async function fetchTable() {
    const res = await fetch(
      `/api/orders?tableNumber=${tableNumber}`,
      { cache: "no-store" }
    )

    if (!res.ok) return

    const payload = await res.json()

    setData(payload)
  }

  useEffect(() => {
    fetchTable()

    let interval = 5000
    const timer = setInterval(fetchTable, interval)

    return () => clearInterval(timer)
  }, [tableNumber])

  if (!data) {
    return (
      <div className="p-4 opacity-60 text-center">
        Loading table…
      </div>
    )
  }

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  return (
    <div className="p-4 space-y-6">
      <Card>
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">
            Table {data.tableNumber}
          </div>
          <Badge>
            {minutesSince(data.firstSubmittedAt)}m
          </Badge>
        </div>
      </Card>

      <Divider />

      <div className="space-y-4">
        {data.initialOrders.map(order => (
          <Card key={order.orderId}>
            <div className="text-sm opacity-70 mb-2">
              Initial order ·{" "}
              {minutesSince(order.submittedAt)}m ago
            </div>

            <div className="space-y-1">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm"
                >
                  <div>
                    {item.quantity}× {item.name}
                  </div>
                  {item.edits && (
                    <div className="opacity-60 text-xs">
                      modified
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}

        {data.addonOrders.length > 0 && (
          <>
            <Divider />
            <div className="text-sm font-semibold opacity-70">
              Add-ons
            </div>
          </>
        )}

        {data.addonOrders.map(order => (
          <Card key={order.orderId}>
            <div className="text-sm opacity-70 mb-2">
              Add-on · {minutesSince(order.submittedAt)}m ago
            </div>

            <div className="space-y-1">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm"
                >
                  <div>
                    {item.quantity}× {item.name}
                  </div>
                  {item.edits && (
                    <div className="opacity-60 text-xs">
                      modified
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {data.initialOrders.length === 0 && (
        <div className="opacity-60 text-center">
          No items yet
        </div>
      )}
    </div>
  )
}
