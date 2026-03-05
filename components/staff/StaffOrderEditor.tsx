"use client"

import { useEffect, useState } from "react"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { EditPanel } from "@/components/order/EditPanel"
import { QuantitySelector } from "@/components/order/QuantitySelector"
import { Button } from "@/components/ui/Button"
import { fetchJson } from "@/lib/fetchJson"
import { calculateItemPrice } from "@/lib/pricing"
import { MenuSection } from "@/lib/types"
import { useCartStore } from "@/store/useCartStore"

export function StaffOrderEditor({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack: () => void
}) {
  const [menu, setMenu] = useState<MenuSection["items"]>([])

  const { items, setScope, addItem, updateItem, removeItem } =
    useCartStore()

  useEffect(() => {
    let cancelled = false
    setScope(`staff:${sessionId}`)

    fetchJson<{ menu: MenuSection[] }>("/api/menu")
      .then(payload => {
        if (cancelled) return
        setMenu(payload.menu.flatMap(s => s.items))
      })
      .catch(() => {
        if (cancelled) return
        setMenu([])
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, setScope])

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
        <div className="status-chip status-chip-neutral mono-font">
          {sessionId.slice(0, 8)}
        </div>
      </div>

      <div className="space-y-3">
        {menu.map(item => {
          const cartItem = items.find(i => i.id === item.id)
          const quantity = cartItem?.quantity ?? 0

          return (
            <MenuItemCard
              key={item.id}
              name={item.name}
              description={item.description}
              image={item.image}
              price={calculateItemPrice(
                item.basePrice,
                cartItem?.edits
              )}
              vatRate={item.vatRate}
              allergens={item.allergens}
              station={item.station}
              editableOptions={item.editableOptions}
              variant="staff"
            >
              <QuantitySelector
                value={quantity}
                onChange={nextQuantity => {
                  if (nextQuantity === 0) {
                    removeItem(item.id)
                    return
                  }

                  if (cartItem) {
                    updateItem(item.id, {
                      quantity: nextQuantity,
                      unitPrice: calculateItemPrice(
                        item.basePrice,
                        cartItem.edits
                      ),
                    })
                    return
                  }

                  addItem({
                    id: item.id,
                    name: item.name,
                    quantity: nextQuantity,
                    edits: null,
                    allergens: item.allergens,
                    unitPrice: item.basePrice,
                    vatRate: item.vatRate,
                    station: item.station,
                  })
                }}
              />

              {cartItem && (
                <EditPanel
                  item={item}
                  value={cartItem.edits}
                  onChange={edits =>
                    updateItem(item.id, {
                      edits,
                      unitPrice: calculateItemPrice(
                        item.basePrice,
                        edits
                      ),
                    })
                  }
                />
              )}
            </MenuItemCard>
          )
        })}
      </div>
    </div>
  )
}
