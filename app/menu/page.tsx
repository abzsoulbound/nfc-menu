'use client'

import { useEffect, useState } from "react"
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { menu as bootstrapMenu } from "@/lib/menu-data"

export const dynamic = "force-dynamic"

type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  available?: boolean
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

export default function PublicMenuPage() {
  const [menu, setMenu] = useState<MenuSectionType[]>([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    null as string | null
  )

  useEffect(() => {
    let cancelled = false

    const bootstrapVisibleMenu = () =>
      bootstrapMenu.map(section => ({
        id: section.id,
        name: section.name,
        items: section.items,
      }))

    async function loadMenu() {
      try {
        const res = await fetch("/api/menu", {
          cache: "no-store",
        })
        if (!res.ok) throw new Error("menu_fetch_failed")
        const payload = await res.json()
        const nextMenu = (Array.isArray(payload?.menu)
          ? payload.menu
          : []) as MenuSectionType[]
        const visibleMenu =
          nextMenu.length > 0
            ? nextMenu.map(section => ({
                ...section,
                items: section.items.filter(item => item.available !== false),
              }))
            : bootstrapVisibleMenu()

        if (cancelled) return

        setMenu(visibleMenu)
        setLocked(Boolean(payload?.locked))
        setSelectedCategoryId(current => {
          if (current && visibleMenu.some(s => s.id === current)) {
            return current
          }
          return visibleMenu[0]?.id ?? null
        })
        setLoading(false)
      } catch {
        const visibleMenu = bootstrapVisibleMenu()
        setMenu(visibleMenu)
        setLocked(false)
        setSelectedCategoryId(current => {
          if (current && visibleMenu.some(s => s.id === current)) {
            return current
          }
          return visibleMenu[0]?.id ?? null
        })
        setLoading(false)
      }
    }

    loadMenu()
    const interval = setInterval(loadMenu, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  if (loading) {
    return (
      <div className="menu-page">
        <div className="menu-empty-state">Loading menu...</div>
      </div>
    )
  }

  return (
    <div className="menu-page">
      {locked && (
        <div className="menu-lock-banner">
          Menu is currently locked during service.
        </div>
      )}

      <div className="category-bar">
        {menu.map(section => (
          <button
            key={section.id}
            onClick={() => setSelectedCategoryId(section.id)}
            className={
              section.id === selectedCategoryId
                ? "category-pill active"
                : "category-pill"
            }
          >
            {section.name}
          </button>
        ))}
      </div>

      {activeSection && (
        <MenuSection title={activeSection.name}>
          {activeSection.items.map(item => (
            <MenuItemCard
              key={item.id}
              name={item.name}
              description={item.description}
              image={item.image}
              price={item.basePrice}
              vatRate={item.vatRate}
              allergens={item.allergens}
            />
          ))}
        </MenuSection>
      )}

      {menu.length === 0 && (
        <div className="menu-empty-state">
          Menu unavailable
        </div>
      )}
    </div>
  )
}
