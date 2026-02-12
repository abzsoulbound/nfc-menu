"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Badge } from "@/components/ui/Badge"
import { Toast } from "@/components/ui/Toast"

type Item = {
  orderItemId: string
  status: string
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
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchTable() {
    const res = await fetch(
      `/api/orders?tableNumber=${tableNumber}`,
      { cache: "no-store" }
    )

    if (!res.ok) return

    const payload = await res.json()

    setData(payload)
  }

  async function setOrderItemQty(
    item: Item,
    nextQty: number
  ) {
    if (!item.orderItemId || nextQty < 0) return

    setUpdatingItemId(item.orderItemId)
    setError(null)
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId: item.orderItemId,
          quantity: nextQty,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(
          payload?.error ?? "ORDER_ITEM_UPDATE_FAILED"
        )
      }
      await fetchTable()
    } catch (e: any) {
      setError(
        `Could not update item quantity (${e?.message ?? "unknown"}).`
      )
    } finally {
      setUpdatingItemId(null)
    }
  }

  async function changeOrderItemQty(
    item: Item,
    delta: 1 | -1
  ) {
    await setOrderItemQty(item, item.quantity + delta)
  }

  async function removeOrderItem(item: Item) {
    await setOrderItemQty(item, 0)
  }

  useEffect(() => {
    fetchTable()

    const timer = setInterval(fetchTable, 3000)

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
      {error && <Toast>{error}</Toast>}

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
              {order.items.map(item => (
                <div
                  key={item.orderItemId}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    {item.quantity}× {item.name}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status !== "completed" && (
                      <>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            changeOrderItemQty(item, -1)
                          }
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            changeOrderItemQty(item, 1)
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-red-600"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            removeOrderItem(item)
                          }
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {item.edits && (
                      <div className="opacity-60 text-xs">
                        modified
                      </div>
                    )}
                    {item.status === "completed" && (
                      <div className="opacity-60 text-xs">
                        completed
                      </div>
                    )}
                  </div>
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
              {order.items.map(item => (
                <div
                  key={item.orderItemId}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    {item.quantity}× {item.name}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status !== "completed" && (
                      <>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            changeOrderItemQty(item, -1)
                          }
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            changeOrderItemQty(item, 1)
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-red-600"
                          disabled={updatingItemId === item.orderItemId}
                          onClick={() =>
                            removeOrderItem(item)
                          }
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {item.edits && (
                      <div className="opacity-60 text-xs">
                        modified
                      </div>
                    )}
                    {item.status === "completed" && (
                      <div className="opacity-60 text-xs">
                        completed
                      </div>
                    )}
                  </div>
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
