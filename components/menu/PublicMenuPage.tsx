'use client'

import { useEffect, useRef, useState } from "react"
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { menu as bootstrapMenu } from "@/lib/menu-data"
import { trackEvent } from "@/lib/analytics"

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
  const [restaurantId, setRestaurantId] = useState("unknown")

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    null as string | null
  )
  const menuViewTrackedRef = useRef(false)
  const requestIdRef = useRef("unknown")
  const lastCategoryTrackedRef = useRef<string | null>(null)

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
        const requestId = res.headers.get("x-request-id")
        if (requestId) {
          requestIdRef.current = requestId
        }
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
        if (
          payload?.restaurant &&
          typeof payload.restaurant.id === "string"
        ) {
          setRestaurantId(payload.restaurant.id)
        }
        setSelectedCategoryId(current => {
          if (current && visibleMenu.some(s => s.id === current)) {
            return current
          }
          return visibleMenu[0]?.id ?? null
        })
        setLoading(false)
        if (!menuViewTrackedRef.current) {
          trackEvent("menu_view", {
            restaurantId:
              typeof payload?.restaurant?.id === "string"
                ? payload.restaurant.id
                : restaurantId,
            requestId: requestIdRef.current,
          })
          menuViewTrackedRef.current = true
        }
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
    // Menu is static; no polling needed
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) return

    if (lastCategoryTrackedRef.current === null) {
      lastCategoryTrackedRef.current = selectedCategoryId
      return
    }

    if (lastCategoryTrackedRef.current !== selectedCategoryId) {
      trackEvent("search_used", {
        restaurantId,
        requestId: requestIdRef.current,
        query: selectedCategoryId,
        mode: "category_chip",
      })
      lastCategoryTrackedRef.current = selectedCategoryId
    }
  }, [selectedCategoryId, restaurantId])

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  if (loading) {
    return (
      <div className="menu-page">
        <div className="order-skeleton">
          <div className="skeleton-block skeleton-pill" />
          <div className="order-skeleton-grid">
            <div className="skeleton-block skeleton-card" />
            <div className="skeleton-block skeleton-card" />
            <div className="skeleton-block skeleton-card" />
          </div>
        </div>
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
