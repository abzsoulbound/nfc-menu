"use client"

import { useEffect, useState } from "react"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { QuantitySelector } from "@/components/order/QuantitySelector"
import { Button } from "@/components/ui/Button"
import { useCartStore } from "@/store/useCartStore"

type Station = "KITCHEN" | "BAR"

type MenuItem = {
  id: string
  name: string
  description?: string
  basePrice: number
  vatRate?: number
  allergens?: string[]
  station?: Station | string
}

type MenuSection = { items: MenuItem[] }
type MenuResponse = { menu: MenuSection[] }

export function StaffOrderEditor({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack: () => void
}) {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const { items, addItem, updateItem, removeItem } = useCartStore()

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/menu")
      const data = (await res.json()) as MenuResponse
      setMenu(data.menu.flatMap(s => s.items))
    }
    load()
  }, [])

  return (
    <div className="p-4 space-y-4">
      <Button variant="secondary" onClick={onBack}>
        Back
      </Button>

      {menu.map(item => {
        const cartItem = items.find(i => i.id === item.id)

        const allergens: string[] = Array.isArray(item.allergens) ? item.allergens : []
        const station: Station = item.station === "BAR" ? "BAR" : "KITCHEN"

        return (
          <MenuItemCard
            key={item.id}
            mode="editor"
            name={item.name}
            description={item.description ?? ""}
            price={item.basePrice}
            vatRate={item.vatRate ?? 0}
            allergens={allergens}
          >
            <QuantitySelector
              value={cartItem?.quantity ?? 0}
              onChange={(q: number) => {
                if (q === 0) {
                  removeItem(item.id)
                  return
                }

                if (cartItem) {
                  updateItem(item.id, { quantity: q })
                  return
                }

                addItem({
                  id: item.id,
                  name: item.name,
                  quantity: q,
                  edits: null,
                  allergens,
                  unitPrice: item.basePrice,
                  station,
                })
              }}
            />
          </MenuItemCard>
        )
      })}
    </div>
  )
}
