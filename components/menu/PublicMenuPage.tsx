'use client'

import { useEffect, useRef, useState } from "react"
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import {
  ProductDetail,
  type ProductOptionGroup,
} from "@/components/order/ProductDetail"
import { menu as bootstrapMenu } from "@/lib/menu-data"
import {
  defaultModifierSelections,
  type MenuCustomization,
} from "@/lib/menuCustomizations"
import {
  defaultSelectionsFromOptionGroups,
  normalizeItemOptionGroups,
} from "@/lib/optionGroups"
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
  customization?: MenuCustomization | null
  optionGroups?: ProductOptionGroup[]
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

function isGroupSatisfied(
  group: ProductOptionGroup,
  selectedIds: string[]
): boolean {
  if (!group.required) return true

  if (group.type === "single") {
    return selectedIds.length === 1
  }

  if (group.type === "multi") {
    const min = typeof group.min === "number" && group.min > 0 ? group.min : 1
    return selectedIds.length >= min
  }

  return selectedIds.length >= 1
}

export default function PublicMenuPage() {
  const [menu, setMenu] = useState<MenuSectionType[]>([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState("unknown")
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null)
  const [previewQuantity, setPreviewQuantity] = useState(1)
  const [previewSelections, setPreviewSelections] = useState<Record<string, string[]>>({})
  const [previewError, setPreviewError] = useState<string | null>(null)

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

  if (previewItem) {
    const previewGroups = normalizeItemOptionGroups(previewItem)
    const previewRequiredRemaining = previewGroups.reduce((count, group) => {
      const selectedIds = previewSelections[group.id] ?? []
      return isGroupSatisfied(group, selectedIds) ? count : count + 1
    }, 0)
    const previewDelta = previewGroups.reduce((delta, group) => {
      const selectedIds = previewSelections[group.id] ?? []
      const groupDelta = group.options
        .filter(option => selectedIds.includes(option.id))
        .reduce((sum, option) => sum + Number(option.priceDelta ?? 0), 0)
      return delta + groupDelta
    }, 0)
    const previewTotal = Number(
      ((previewItem.basePrice + previewDelta) * previewQuantity).toFixed(2)
    )

    return (
      <div className="order-page">
        <ProductDetail
          item={previewItem}
          quantity={previewQuantity}
          groups={previewGroups}
          selections={previewSelections}
          requiredRemaining={previewRequiredRemaining}
          customizerError={previewError}
          totalPrice={previewTotal}
          onClose={() => {
            setPreviewItem(null)
            setPreviewError(null)
            setPreviewQuantity(1)
            setPreviewSelections({})
          }}
          onToggleOption={(groupId, optionId, selected) => {
            setPreviewSelections(current => {
              const groups = normalizeItemOptionGroups(previewItem)
              const group = groups.find(value => value.id === groupId)
              if (!group) return current
              const existing = current[groupId] ?? []

              let nextForGroup = [...existing]
              if (group.type === "single" || group.type === "adjustable") {
                nextForGroup = selected ? [optionId] : []
              } else if (selected) {
                const max =
                  typeof group.max === "number" && group.max > 0
                    ? group.max
                    : null
                if (max !== null && !existing.includes(optionId) && existing.length >= max) {
                  return current
                }
                nextForGroup = [...new Set([...existing, optionId])]
              } else {
                nextForGroup = existing.filter(value => value !== optionId)
              }

              return {
                ...current,
                [groupId]: nextForGroup,
              }
            })
            setPreviewError(null)
          }}
          onQuantityChange={nextQty => {
            setPreviewQuantity(nextQty)
            setPreviewError(null)
          }}
          onAddToBasket={() => {
            setPreviewError("Scan your table NFC tag to start ordering.")
          }}
          addDisabled={false}
        />
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
              onClick={() => {
                const groups = normalizeItemOptionGroups(item)
                setPreviewItem(item)
                setPreviewQuantity(1)
                setPreviewSelections({
                  ...defaultModifierSelections(item.customization),
                  ...defaultSelectionsFromOptionGroups(groups),
                })
                setPreviewError(null)
              }}
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
