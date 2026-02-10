"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { QuantitySelector } from "@/components/order/QuantitySelector"
import { EditPanel } from "@/components/order/EditPanel"
import { AllergenList } from "@/components/menu/AllergenList"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"
import { calculateItemPrice } from "@/lib/pricing"

type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  editableOptions: any
  station: "KITCHEN" | "BAR"
}

type TableState = {
  tableId: string | null
  locked: boolean
  stale: boolean
  closed: boolean
}

export default function TagOrderingPage({
  params,
}: {
  params: { tagId: string }
}) {
  const tagId = params.tagId
  const router = useRouter()

  const { sessionId, ensureSession } = useSessionStore()
  const { items, addItem, updateItem, removeItem } =
    useCartStore()

  const [menu, setMenu] = useState<MenuItem[]>([])
  const [tableState, setTableState] =
    useState<TableState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const session = await ensureSession(tagId)

      const [menuRes, tagRes] = await Promise.all([
        fetch("/api/menu", { cache: "no-store" }),
        fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        }),
      ])

      const menuPayload = await menuRes.json()
      const tagPayload = await tagRes.json()

      setMenu(menuPayload.menu.flatMap((s: any) => s.items))

      if (tagPayload.tableId) {
        const tableRes = await fetch(
          `/api/tables?tableId=${tagPayload.tableId}`,
          { cache: "no-store" }
        )
        const table = await tableRes.json()

        setTableState({
          tableId: table.id,
          locked: table.locked,
          stale: table.stale,
          closed: table.closed,
        })
      } else {
        setTableState({
          tableId: null,
          locked: false,
          stale: false,
          closed: false,
        })
      }

      setLoading(false)
    }

    init()
  }, [tagId, ensureSession])

  if (loading) {
    return (
      <div className="p-4 opacity-60 text-center">
        Loading menu…
      </div>
    )
  }

  const viewOnly =
    tableState?.locked ||
    tableState?.stale ||
    tableState?.closed

  return (
    <div className="p-4 space-y-6">
      {viewOnly && (
        <Card>
          <div className="text-sm opacity-70">
            Ordering is closed for this table. Please
            refer to a waiter if you need to make changes.
          </div>
        </Card>
      )}

      {menu.map(item => {
        const cartItem = items.find(i => i.id === item.id)
        const quantity = cartItem?.quantity ?? 0
        const price = calculateItemPrice(
          item.basePrice,
          cartItem?.edits
        )

        return (
          <Card key={item.id}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">
                    {item.name}
                  </div>
                  <div className="text-sm opacity-70">
                    {item.description}
                  </div>
                </div>
                <div className="text-sm">
                  £{price.toFixed(2)}
                </div>
              </div>

              <AllergenList allergens={item.allergens} />

              {!viewOnly && (
                <>
                  <QuantitySelector
                    value={quantity}
                    onChange={q => {
                      if (q === 0) {
                        removeItem(item.id)
                      } else if (cartItem) {
                        updateItem(item.id, {
                          quantity: q,
                        })
                      } else {
                        addItem({
                          id: item.id,
                          name: item.name,
                          quantity: q,
                          edits: null,
                          allergens: item.allergens,
                          unitPrice: price,
                          station: item.station,
                        })
                      }
                    }}
                  />

                  {quantity > 0 && (
                    <EditPanel
                      item={item}
                      value={cartItem?.edits}
                      onChange={edits =>
                        updateItem(item.id, { edits })
                      }
                    />
                  )}
                </>
              )}
            </div>
          </Card>
        )
      })}

      <Divider />

      <Button
        disabled={
          viewOnly || items.length === 0 || !sessionId
        }
        onClick={() => router.push(`/t/${tagId}/review`)}
      >
        Review & add to table
      </Button>
    </div>
  )
}
