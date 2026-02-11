"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Divider } from "@/components/ui/Divider"

type MenuItem = {
  id: string
  name: string
  available: boolean
}

type MenuSection = {
  id: string
  name: string
  items: MenuItem[]
}

export function MenuManager() {
  const [menu, setMenu] = useState<MenuSection[]>([])
  const [loading, setLoading] = useState(true)

  async function loadMenu() {
    const res = await fetch("/api/menu", {
      cache: "no-store",
    })
    if (!res.ok) return
    const payload = await res.json()
    const next = Array.isArray(payload?.menu)
      ? (payload.menu as MenuSection[])
      : []
    setMenu(next)
    setLoading(false)
  }

  useEffect(() => {
    loadMenu()
  }, [])

  async function toggleItem(itemId: string, available: boolean) {
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        available: !available,
      }),
    })
    loadMenu()
  }

  if (loading) {
    return (
      <Card>
        <div className="text-sm opacity-70">Loading menu manager...</div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="text-lg font-semibold">Menu Availability</div>
        <div className="text-sm opacity-70">
          Disable items instantly without redeploying.
        </div>
      </Card>

      {menu.map(section => (
        <Card key={section.id}>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{section.name}</div>
            <Divider />
            {section.items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="text-sm">{item.name}</div>
                <Button
                  variant={item.available ? "secondary" : "primary"}
                  onClick={() => toggleItem(item.id, item.available)}
                >
                  {item.available ? "Disable" : "Enable"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
