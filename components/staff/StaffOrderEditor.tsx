"use client"

import { useEffect, useState } from "react"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { QuantitySelector } from "@/components/order/QuantitySelector"
import EditPanel from "@/components/order/EditPanel"
import { Button } from "@/components/ui/Button"
import { useCartStore } from "@/store/useCartStore"

type MenuItem = {
  id: string
  name: string
  description: string
  basePrice: number
  vatRate: number
  allergens?: string[]
  station?: string
}

type MenuSection = {
  items: MenuItem[]
}

type MenuResponse = {
  menu: MenuSection[]
}

export function StaffOrderEditor({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack: () => void
}) {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const { items, addItem, updateItem, removeItem } =
    useCartStore()

  useEffect(() => {
    const loadMenu = async () => {
      const res = await fetch("/api/menu")
      const data: MenuResponse = await res.json()
      const flatItems = data.menu.flatMap(section => section.items)
      setMenu(flatItems)
    }

    loadMenu()
  }, [])

  return (
    <div className="p-4 space-y-4">
      <Button variant="secondary" onClick={onBack}>
        Back
      </Button>

      {menu.map(item => {
        const cartItem = items.find(i => i.id === item.id)

        return (
          <MenuItemCard
            key={item.id}
            mode="editor"
            name={item.name}
            description={item.description}
            price={item.basePrice}
            vatRate={item.vatRate}
            allergens={item.allergens}
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
                } else {
                  addItem({
                    id: item.id,
                    name: item.name,
                    quantity: q,
                    edits: null as unknown,
                    allergens: item.allergens || [],
                    unitPrice: item.basePrice,
                    station: (item.station || "KITCHEN") as "KITCHEN" | "BAR",
                  })
                }
              }}
            />

            {/* EditPanel temporarily disabled - needs proper implementation
            {cartItem && (
              <EditPanel
                item={item}
                onClose={() => {}}
              />
            )} */}
          </MenuItemCard>
        )
      })}
    </div>
  )
}
