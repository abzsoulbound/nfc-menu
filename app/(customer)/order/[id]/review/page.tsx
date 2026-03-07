"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { fetchJson } from "@/lib/fetchJson"
import { TableReviewDTO } from "@/lib/types"

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

export default function TableReviewPage({
  params,
}: {
  params: { id: string }
}) {
  const tableNumber = Number(params.id)
  const invalidTableNumber = !Number.isFinite(tableNumber)
  const [data, setData] = useState<TableReviewDTO | null>(null)

  useEffect(() => {
    if (invalidTableNumber) return

    async function fetchTable() {
      const payload = await fetchJson<TableReviewDTO>(
        `/api/orders?tableNumber=${tableNumber}`,
        {
          cache: "no-store",
        }
      )
      setData(payload)
    }

    fetchTable().catch(() => setData(null))
    const timer = setInterval(() => {
      fetchTable().catch(() => setData(null))
    }, 5000)

    return () => clearInterval(timer)
  }, [tableNumber, invalidTableNumber])

  if (invalidTableNumber) {
    return (
      <div className="p-4 text-center text-sm text-secondary">
        Invalid table number.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-sm text-secondary">
        Loading table...
      </div>
    )
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-[920px] space-y-4">
        <Card variant="elevated">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="display-font text-4xl tracking-tight">
                Table {data.tableNumber}
              </div>
              <div className="text-sm text-secondary">
                Live order timeline
              </div>
            </div>
            <Badge variant="warning">
              {minutesSince(data.firstSubmittedAt)}m
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Initial order
            </div>

            {data.initialOrders.length === 0 && (
              <div className="text-sm text-secondary">
                No initial order yet.
              </div>
            )}

            {data.initialOrders.map(order => (
              <Card key={order.orderId} variant="accent">
                <div className="space-y-2">
                  <div className="text-xs text-secondary">
                    {minutesSince(order.submittedAt)}m ago
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order.orderId}-${index}`}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div>
                          {item.quantity} x {item.name}
                        </div>
                        {item.edits && (
                          <div className="text-xs text-muted">
                            modified
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {data.addonOrders.length > 0 && (
              <>
                <Divider />
                <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  Add-on orders
                </div>
              </>
            )}

            {data.addonOrders.map(order => (
              <Card key={order.orderId} variant="accent">
                <div className="space-y-2">
                  <div className="text-xs text-secondary">
                    {minutesSince(order.submittedAt)}m ago
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div
                        key={`${order.orderId}-${index}`}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div>
                          {item.quantity} x {item.name}
                        </div>
                        {item.edits && (
                          <div className="text-xs text-muted">
                            modified
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
