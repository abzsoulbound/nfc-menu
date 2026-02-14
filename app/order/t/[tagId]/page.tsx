'use client'

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { useSessionStore } from "@/store/useSessionStore"
import {
  cartLoadErrorMessage,
  cartSyncErrorMessage,
  menuLoadErrorMessage,
  networkErrorMessage,
  readApiErrorInfo,
  sessionConnectErrorMessage,
} from "@/lib/clientApiErrors"
import {
  buildModifierSignature,
  buildModifierSummary,
  calculateModifierDelta,
  collectModifierAllergens,
  defaultModifierSelections,
  getBaseIngredientLabels,
  hasCustomization,
  normalizeModifierSelections,
  type MenuCustomization,
  type ModifierSelections,
  validateModifierSelections,
} from "@/lib/menuCustomizations"
import { tenantTagPath } from "@/lib/tenantPaths"
import { trackEvent } from "@/lib/analytics"

type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  station?: "KITCHEN" | "BAR"
  available?: boolean
  customization?: MenuCustomization | null
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

type CartItem = {
  id: string
  lineKey: string
  name: string
  quantity: number
  menuItemId?: string
  unitPrice?: number
  vatRate?: number
  allergens?: string[]
  station?: "KITCHEN" | "BAR"
  edits?: unknown
}

type CustomizerState = {
  item: MenuItem
  quantity: number
  selections: ModifierSelections
}

type PendingSyncEntry = {
  lineKey: string
  sessionId: string
  clientKey: string | null
  item: MenuItem
  allergens: string[]
  quantity: number
  edits: unknown
  unitPrice: number
  revision: number
}

type CustomizerGroup = MenuCustomization["groups"][number]

const INCLUDED_PAGE_SIZE = 8
const GROUP_OPTION_PAGE_SIZE = 4
const ALLERGY_NOTICE_TEXT =
  "Allergen information is available on request. Our kitchen handles common allergens, so traces may be present."

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function modifierSignatureFromEdits(edits: unknown): string {
  if (!isObject(edits)) return 'base'
  const modifiers = edits.modifiers
  if (!isObject(modifiers)) return 'base'

  const normalized: ModifierSelections = {}
  for (const [groupId, value] of Object.entries(modifiers)) {
    if (!Array.isArray(value)) continue
    normalized[groupId] = value.filter(
      (optionId): optionId is string =>
        typeof optionId === 'string'
    )
  }

  return buildModifierSignature(normalized) || 'base'
}

function groupSelectionMin(group: CustomizerGroup): number {
  if (typeof group.min === "number" && group.min >= 0) {
    return group.min
  }
  return group.required ? 1 : 0
}

function groupSelectionMax(group: CustomizerGroup): number {
  if (typeof group.max === "number" && group.max > 0) {
    return group.max
  }
  if (group.type === "single") return 1
  return group.options.length
}

function groupSelectionHint(group: CustomizerGroup): string {
  const min = groupSelectionMin(group)
  const max = groupSelectionMax(group)

  if (group.type === "single") {
    return min > 0 ? "Choose 1" : "Choose up to 1"
  }

  if (min <= 0) return `Choose up to ${max}`
  if (min === max) return `Choose ${min}`
  return `Choose ${min}-${max}`
}

export default function TagPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()
  const pathname = usePathname()
  const setGlobalSession = useSessionStore(s => s.setSession)
  const ensureClientKey = useSessionStore(s => s.ensureClientKey)

  const [menu, setMenu] = useState<MenuSectionType[]>([])
  const [menuLocked, setMenuLocked] = useState(false)
  const [menuLoading, setMenuLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cartByKey, setCartByKey] = useState<Record<string, CartItem>>({})
  const [customizer, setCustomizer] = useState<CustomizerState | null>(null)
  const [expandedSectionId, setExpandedSectionId] =
    useState<string | null>(null)
  const [customizerOptionPages, setCustomizerOptionPages] =
    useState<Record<string, number>>({})
  const [customizerDragOffset, setCustomizerDragOffset] = useState(0)
  const [customizerError, setCustomizerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string>('unknown')

  const cartByKeyRef = useRef<Record<string, CartItem>>({})
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingSyncEntry>>({})
  const customizerTouchStartYRef = useRef<number | null>(null)
  const lastRequestIdRef = useRef<string>('unknown')
  const menuViewTrackedRef = useRef(false)
  const lastCategoryTrackedRef = useRef<string | null>(null)

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  useEffect(() => {
    cartByKeyRef.current = cartByKey
  }, [cartByKey])

  const notifyHeader = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('nfc-cart-updated'))
  }

  useEffect(() => {
    notifyHeader()
  }, [cartByKey])

  useEffect(() => {
    if (!selectedCategoryId) return

    if (lastCategoryTrackedRef.current === null) {
      lastCategoryTrackedRef.current = selectedCategoryId
      return
    }

    if (lastCategoryTrackedRef.current !== selectedCategoryId) {
      trackEvent('search_used', {
        restaurantId,
        requestId: lastRequestIdRef.current,
        query: selectedCategoryId,
        mode: 'category_chip',
      })
      lastCategoryTrackedRef.current = selectedCategoryId
    }
  }, [selectedCategoryId, restaurantId])

  useEffect(() => {
    setExpandedSectionId(null)
    setCustomizerOptionPages({})
    setCustomizerDragOffset(0)
  }, [customizer?.item.id])

  const loadCart = async (sid: string) => {
    const activeClientKey = ensureClientKey()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch('/api/cart/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            clientKey: activeClientKey,
          }),
        })
        const requestId = res.headers.get('x-request-id')
        if (requestId) {
          lastRequestIdRef.current = requestId
        }

        if (!res.ok) {
          if (attempt === 0) continue
          const errorInfo = await readApiErrorInfo(res)
          setError(cartLoadErrorMessage(errorInfo))
          return false
        }

        const payload = await res.json()
        const items = (payload?.items ?? []) as Array<CartItem & {
          isMine?: boolean
        }>
        const ownItems = items.filter(item => item.isMine !== false)

        const next: Record<string, CartItem> = {}
        for (const item of ownItems) {
          const key =
            item.menuItemId && typeof item.menuItemId === 'string'
              ? `${item.menuItemId}::${modifierSignatureFromEdits(item.edits)}`
              : item.id

          const existing = next[key]
          if (existing) {
            next[key] = {
              ...existing,
              quantity:
                Number(existing.quantity ?? 0) +
                Number(item.quantity ?? 0),
            }
            continue
          }

          next[key] = {
            ...item,
            lineKey: key,
          }
        }

        setCartByKey(next)
        setError(current =>
          current &&
          (
            current.toLowerCase().includes('basket') ||
            current.toLowerCase().includes('cart') ||
            current.toLowerCase().includes('session')
          )
            ? null
            : current
        )
        return true
      } catch {
        if (attempt === 0) continue
        setError(networkErrorMessage('open your basket'))
        return false
      }
    }

    return false
  }

  const loadMenu = async () => {
    try {
      const res = await fetch('/api/menu', {
        cache: 'no-store',
      })
      const requestId = res.headers.get('x-request-id')
      if (requestId) {
        lastRequestIdRef.current = requestId
      }
      if (!res.ok) {
        const errorInfo = await readApiErrorInfo(res)
        setError(menuLoadErrorMessage(errorInfo))
        return
      }

      const payload = await res.json()
      const incoming = Array.isArray(payload?.menu)
        ? (payload.menu as MenuSectionType[])
        : []
      const visible = incoming.map(section => ({
        ...section,
        items: section.items.filter(item => item.available !== false),
      }))
      if (
        payload?.restaurant &&
        typeof payload.restaurant.id === 'string'
      ) {
        setRestaurantId(payload.restaurant.id)
      }

      setMenu(visible)
      setMenuLocked(Boolean(payload?.locked))
      setSelectedCategoryId(current => {
        if (current && visible.some(s => s.id === current)) {
          return current
        }
        return visible[0]?.id ?? null
      })
      setError(current =>
        current &&
        current.toLowerCase().includes('menu')
          ? null
          : current
      )
      if (!menuViewTrackedRef.current) {
        trackEvent('menu_view', {
          restaurantId:
            typeof payload?.restaurant?.id === 'string'
              ? payload.restaurant.id
              : restaurantId,
          requestId: lastRequestIdRef.current,
        })
        menuViewTrackedRef.current = true
      }
    } catch {
      setError(networkErrorMessage('load the menu'))
    } finally {
      setMenuLoading(false)
    }
  }

  useEffect(() => {
    ensureClientKey()
  }, [ensureClientKey])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId: params.tagId }),
        })
        const requestId = res.headers.get('x-request-id')
        if (requestId) {
          lastRequestIdRef.current = requestId
        }

        if (!res.ok) {
          const errorInfo = await readApiErrorInfo(res)
          if (res.status === 409 && errorInfo.code === 'TABLE_CLOSED') {
            router.replace(
              tenantTagPath(pathname, params.tagId, "/closed")
            )
            return
          }
          setError(
            sessionConnectErrorMessage(errorInfo, params.tagId)
          )
          return
        }

        const payload = await res.json()
        if (!mounted) return

        const sid = payload.sessionId as string
        setSessionId(sid)
        setGlobalSession(sid, 'customer')
        await loadCart(sid)
      } catch {
        if (!mounted) return
        setError(networkErrorMessage('connect this table'))
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      mounted = false
    }
  }, [params.tagId, router, setGlobalSession])

  useEffect(() => {
    void loadMenu()
    const interval = window.setInterval(() => {
      void loadMenu()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [params.tagId])

  useEffect(() => {
    if (!sessionId) return

    const interval = window.setInterval(() => {
      void loadCart(sessionId)
    }, 3000)

    return () => window.clearInterval(interval)
  }, [sessionId])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(syncTimersRef.current)) {
        window.clearTimeout(timer)
      }
      syncTimersRef.current = {}
      syncInFlightRef.current = {}
      pendingSyncRef.current = {}
    }
  }, [])

  const flushPendingSync = async (lineKey: string) => {
    if (syncInFlightRef.current[lineKey]) return

    const pending = pendingSyncRef.current[lineKey]
    if (!pending) return

    syncInFlightRef.current[lineKey] = true
    const requestedRevision = pending.revision

    try {
      const existing = cartByKeyRef.current[lineKey]
      const hasServerId = Boolean(
        existing?.id && !existing.id.startsWith('temp:')
      )

      let ok = false
      let createdId: string | null = null
      let syncError: string | null = null

      if (pending.quantity <= 0) {
        if (hasServerId && existing) {
          const res = await fetch('/api/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: pending.sessionId,
              itemId: existing.id,
              quantity: 0,
              clientKey: pending.clientKey,
            }),
          })
          ok = res.ok
          if (!res.ok) {
            const errorInfo = await readApiErrorInfo(res)
            syncError = cartSyncErrorMessage(errorInfo)
          }
        } else {
          ok = true
        }
      } else if (hasServerId && existing) {
        const res = await fetch('/api/cart/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: pending.sessionId,
            itemId: existing.id,
            quantity: pending.quantity,
            edits: pending.edits,
            clientKey: pending.clientKey,
          }),
        })
        ok = res.ok
        if (!res.ok) {
          const errorInfo = await readApiErrorInfo(res)
          syncError = cartSyncErrorMessage(errorInfo)
        }
      } else {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: pending.sessionId,
            menuItemId: pending.item.id,
            name: pending.item.name,
            unitPrice: pending.unitPrice,
            vatRate: pending.item.vatRate,
            allergens: pending.allergens,
            station: pending.item.station ?? 'KITCHEN',
            quantity: pending.quantity,
            edits: pending.edits,
            clientKey: pending.clientKey,
          }),
        })

        ok = res.ok
        if (!res.ok) {
          const errorInfo = await readApiErrorInfo(res)
          syncError = cartSyncErrorMessage(errorInfo)
        }
        if (res.ok) {
          const payload = await res
            .json()
            .catch(() => null as { id?: unknown } | null)
          if (payload?.id && typeof payload.id === 'string') {
            createdId = payload.id
          }
        }
      }

      if (!ok) {
        setError(syncError ?? "We couldn't update your basket. Retrying now.")
        await loadCart(pending.sessionId)
        return
      }

      if (createdId) {
        setCartByKey(current => {
          const currentItem = current[lineKey]
          if (!currentItem) return current
          return {
            ...current,
            [lineKey]: {
              ...currentItem,
              id: createdId,
            },
          }
        })
      }
    } catch {
      setError(networkErrorMessage('sync your cart'))
      await loadCart(pending.sessionId)
    } finally {
      syncInFlightRef.current[lineKey] = false

      const latest = pendingSyncRef.current[lineKey]
      if (!latest) return

      if (latest.revision !== requestedRevision) {
        window.setTimeout(() => {
          void flushPendingSync(lineKey)
        }, 0)
        return
      }

      delete pendingSyncRef.current[lineKey]
      const timer = syncTimersRef.current[lineKey]
      if (timer) {
        window.clearTimeout(timer)
        delete syncTimersRef.current[lineKey]
      }
    }
  }

  const scheduleSync = (
    lineKey: string,
    sessionForSync: string,
    clientKeyForSync: string | null,
    item: MenuItem,
    allergens: string[],
    quantity: number,
    edits: unknown,
    unitPrice: number
  ) => {
    const existing = pendingSyncRef.current[lineKey]
    const nextRevision = (existing?.revision ?? 0) + 1

    pendingSyncRef.current[lineKey] = {
      lineKey,
      sessionId: sessionForSync,
      clientKey: clientKeyForSync,
      item,
      allergens,
      quantity,
      edits,
      unitPrice,
      revision: nextRevision,
    }

    const existingTimer = syncTimersRef.current[lineKey]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    syncTimersRef.current[lineKey] = window.setTimeout(() => {
      void flushPendingSync(lineKey)
    }, 24)
  }

  const applyOptimisticLine = (
    lineKey: string,
    nextItem: CartItem | null
  ) => {
    setCartByKey(current => {
      const next = { ...current }
      if (!nextItem || nextItem.quantity <= 0) {
        delete next[lineKey]
      } else {
        next[lineKey] = nextItem
      }
      cartByKeyRef.current = next
      return next
    })
  }

  const openCustomizer = (item: MenuItem) => {
    if (menuLocked) return
    if (!sessionId) {
      setError('Live connection required. Please reload table.')
      return
    }
    const defaultSelections = defaultModifierSelections(
      item.customization
    )
    const firstGroupId = hasCustomization(item.customization)
      ? item.customization.groups[0]?.id ?? null
      : null
    const included = getBaseIngredientLabels(item.customization)

    setCustomizer({
      item,
      quantity: 1,
      selections: defaultSelections,
    })
    if (firstGroupId) {
      setExpandedSectionId(`group:${firstGroupId}`)
    } else if (included.length > 0) {
      setExpandedSectionId('included')
    } else {
      setExpandedSectionId('allergens')
    }
    setCustomizerError(null)
    trackEvent('item_opened', {
      restaurantId,
      requestId: lastRequestIdRef.current,
      menuItemId: item.id,
    })
  }

  const closeCustomizer = () => {
    setCustomizer(null)
    setExpandedSectionId(null)
    setCustomizerError(null)
    setCustomizerDragOffset(0)
    customizerTouchStartYRef.current = null
  }

  const handleCustomizerTouchStart = (
    event: TouchEvent<HTMLElement>
  ) => {
    if (typeof window === 'undefined' || window.innerWidth > 760) return
    customizerTouchStartYRef.current = event.touches[0]?.clientY ?? null
  }

  const handleCustomizerTouchMove = (
    event: TouchEvent<HTMLElement>
  ) => {
    const startY = customizerTouchStartYRef.current
    if (startY === null) return
    const nextY = event.touches[0]?.clientY ?? startY
    const delta = nextY - startY
    if (delta <= 0) {
      setCustomizerDragOffset(0)
      return
    }
    setCustomizerDragOffset(Math.min(delta, 150))
  }

  const handleCustomizerTouchEnd = () => {
    if (customizerTouchStartYRef.current === null) return
    const shouldClose = customizerDragOffset > 96
    customizerTouchStartYRef.current = null
    setCustomizerDragOffset(0)
    if (shouldClose) {
      closeCustomizer()
    }
  }

  const updateCustomizerSelection = (
    groupId: string,
    optionId: string,
    selected: boolean
  ) => {
    setCustomizer(current => {
      if (!current) return current
      const customization = current.item.customization
      if (!hasCustomization(customization)) return current

      const group = customization.groups.find(value => value.id === groupId)
      if (!group) return current

      const existing = current.selections[groupId] ?? []
      let nextForGroup = [...existing]

      if (group.type === 'single') {
        nextForGroup = selected ? [optionId] : []
      } else if (selected) {
        nextForGroup = [...existing, optionId]
      } else {
        nextForGroup = existing.filter(value => value !== optionId)
      }

      const normalized = normalizeModifierSelections(customization, {
        ...current.selections,
        [groupId]: nextForGroup,
      })

      return {
        ...current,
        selections: normalized,
      }
    })
  }

  const applyCustomizedItem = () => {
    if (!customizer) return
    if (!sessionId) {
      setError('Live connection required. Please reload table.')
      return
    }

    const item = customizer.item
    const customization = item.customization

    const validation = validateModifierSelections(customization, customizer.selections)
    if (!validation.ok) {
      setCustomizerError(validation.error ?? 'Invalid selection')
      return
    }

    const normalized = validation.normalized
    const modifierSummary = buildModifierSummary(customization, normalized)
    const modifierDelta = calculateModifierDelta(customization, normalized)
    const lineAllergens = collectModifierAllergens(
      customization,
      normalized,
      item.allergens ?? []
    )
    const unitPrice = Number((item.basePrice + modifierDelta).toFixed(2))
    const lineSignature =
      hasCustomization(customization)
        ? buildModifierSignature(normalized) || 'base'
        : 'base'
    const lineKey = `${item.id}::${lineSignature}`

    const existing = cartByKeyRef.current[lineKey]
    const nextQty = Number(existing?.quantity ?? 0) + customizer.quantity
    const edits = hasCustomization(customization)
      ? {
          modifiers: normalized,
          modifierPriceDelta: modifierDelta,
          modifierSummary,
        }
      : null

    applyOptimisticLine(lineKey, {
      id: existing?.id ?? `temp:${lineKey}`,
      lineKey,
      name: item.name,
      quantity: nextQty,
      menuItemId: item.id,
      unitPrice,
      vatRate: item.vatRate,
      allergens: lineAllergens,
      station: item.station ?? 'KITCHEN',
      edits,
    })

    scheduleSync(
      lineKey,
      sessionId,
      ensureClientKey(),
      item,
      lineAllergens,
      nextQty,
      edits,
      unitPrice
    )

    trackEvent('add_to_cart', {
      restaurantId,
      requestId: lastRequestIdRef.current,
      menuItemId: item.id,
      quantity: customizer.quantity,
      lineKey,
    })

    closeCustomizer()
  }

  const customizerValidation = useMemo(() => {
    if (!customizer) return null
    return validateModifierSelections(
      customizer.item.customization,
      customizer.selections
    )
  }, [customizer])

  const customizerUnitPrice = useMemo(() => {
    if (!customizer) return 0
    const delta = calculateModifierDelta(
      customizer.item.customization,
      customizerValidation?.normalized ?? {}
    )
    return Number((customizer.item.basePrice + delta).toFixed(2))
  }, [customizer, customizerValidation])

  const customizerLayout = useMemo(() => {
    if (!customizer || !hasCustomization(customizer.item.customization)) {
      return {
        groups: [] as CustomizerGroup[],
        includedLines: [] as string[],
      }
    }

    const customization = customizer.item.customization
    const groups = customization.groups

    return {
      groups,
      includedLines: getBaseIngredientLabels(customization),
    }
  }, [customizer])

  const customizerAllergens = useMemo(() => {
    if (!customizer) return []
    const baseAllergens = customizer.item.allergens ?? []
    const fromSelections = collectModifierAllergens(
      customizer.item.customization,
      customizerValidation?.normalized ?? {},
      baseAllergens
    )

    return Array.from(
      new Set(
        fromSelections
          .map(value => value.trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [customizer, customizerValidation])

  const customizerGroups = customizerLayout.groups

  const requiredRemaining = useMemo(() => {
    if (!customizer) return 0
    return customizerGroups.reduce((count, group) => {
      const min = groupSelectionMin(group)
      if (min <= 0) return count
      const selected = customizer.selections[group.id]?.length ?? 0
      return selected >= min ? count : count + 1
    }, 0)
  }, [customizer, customizerGroups])

  const customizerTitleId = customizer
    ? `customizer-title-${customizer.item.id}`
    : 'customizer-title'
  const customizerDescriptionId = customizer
    ? `customizer-description-${customizer.item.id}`
    : 'customizer-description'
  const customizerImageSrc =
    customizer?.item.image && customizer.item.image.trim().length > 0
      ? customizer.item.image
      : null

  const retryOrderData = () => {
    if (sessionId) {
      void loadCart(sessionId)
    } else {
      window.location.reload()
    }
    void loadMenu()
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSectionId(current =>
      current === sectionId ? null : sectionId
    )
  }

  if (loading || menuLoading) {
    return (
      <div className="order-page">
        <div className="order-skeleton">
          <div className="skeleton-block skeleton-pill" />
          <div className="order-skeleton-grid">
            <div className="skeleton-block skeleton-card" />
            <div className="skeleton-block skeleton-card" />
            <div className="skeleton-block skeleton-card" />
          </div>
          <div className="skeleton-block skeleton-footer" />
        </div>
      </div>
    )
  }

  return (
    <div className="menu-page">
      {error && (
        <div className="menu-lock-banner menu-lock-banner--error">
          <span>{error}</span>
          <button
            type="button"
            className="menu-error-retry"
            onClick={retryOrderData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="category-bar">
        {menu.map(section => (
          <button
            key={section.id}
            onClick={() => setSelectedCategoryId(section.id)}
            className={
              section.id === selectedCategoryId
                ? 'category-pill active'
                : 'category-pill'
            }
          >
            {section.name}
          </button>
        ))}
      </div>

      {menuLocked && (
        <div className="menu-lock-banner">
          Ordering is temporarily paused by staff.
        </div>
      )}

      {activeSection && (
        <MenuSection title={activeSection.name}>
          {activeSection.items.map(item => {
            return (
              <MenuItemCard
                key={item.id}
                name={item.name}
                description={item.description}
                image={item.image}
                price={item.basePrice}
                allergens={item.allergens}
                onClick={menuLocked ? undefined : () => openCustomizer(item)}
              />
            )
          })}
        </MenuSection>
      )}

      {!activeSection && (
        <div className="menu-empty-state">Menu unavailable</div>
      )}

      {customizer && (
        <div
          className="modal-overlay customizer-overlay"
          onClick={closeCustomizer}
        >
          <section
            className="customizer-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby={customizerTitleId}
            aria-describedby={customizerDescriptionId}
            onClick={event => event.stopPropagation()}
            onTouchStart={handleCustomizerTouchStart}
            onTouchMove={handleCustomizerTouchMove}
            onTouchEnd={handleCustomizerTouchEnd}
            style={
              customizerDragOffset > 0
                ? { transform: `translateY(${customizerDragOffset}px)` }
                : undefined
            }
          >
            <header className="customizer-top">
              <div
                className={
                  customizerImageSrc
                    ? "customizer-top-image"
                    : "customizer-top-image customizer-top-image--fallback"
                }
                aria-hidden="true"
              >
                {customizerImageSrc ? (
                  <img
                    className="customizer-hero-image"
                    src={customizerImageSrc}
                    alt=""
                  />
                ) : (
                  <div className="customizer-hero-fallback" />
                )}
              </div>
              <div className="customizer-meta">
                <div className="customizer-summary-head">
                  <h2 id={customizerTitleId} className="customizer-title">
                    {customizer.item.name}
                  </h2>
                  <span className="customizer-base-price">
                    From £{customizer.item.basePrice.toFixed(2)}
                  </span>
                </div>
                <p
                  id={customizerDescriptionId}
                  className="customizer-description customizer-description--compact"
                >
                  {customizer.item.description ||
                    "Customize ingredients and quantity before adding to your order."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomizer}
                className="customizer-close-btn"
                aria-label="Close item details"
              >
                ×
              </button>
            </header>

            <div className="customizer-stage customizer-stage--single">
              <section className="customizer-pane customizer-pane--stack">
                {customizerGroups.length > 0 ? (
                  customizerGroups.map(group => {
                    const sectionId = `group:${group.id}`
                    const isOpen = expandedSectionId === sectionId
                    const min = groupSelectionMin(group)
                    const max = groupSelectionMax(group)
                    const selectedCount =
                      customizer.selections[group.id]?.length ?? 0
                    const pageCount = Math.max(
                      1,
                      Math.ceil(group.options.length / GROUP_OPTION_PAGE_SIZE)
                    )
                    const page = clampIndex(
                      customizerOptionPages[group.id] ?? 0,
                      pageCount
                    )
                    const visibleOptions = isOpen
                      ? group.options.slice(
                          page * GROUP_OPTION_PAGE_SIZE,
                          page * GROUP_OPTION_PAGE_SIZE +
                            GROUP_OPTION_PAGE_SIZE
                        )
                      : []

                    return (
                      <article
                        key={group.id}
                        className={
                          isOpen
                            ? "customizer-section-card is-open"
                            : "customizer-section-card"
                        }
                      >
                        <button
                          type="button"
                          className="customizer-section-trigger"
                          onClick={() => toggleSection(sectionId)}
                          aria-expanded={isOpen}
                        >
                          <span className="customizer-section-copy">
                            <span className="customizer-group-label">
                              {group.name}
                            </span>
                            <span className="customizer-group-meta">
                              {min > 0 ? "Required" : "Optional"} ·{" "}
                              {groupSelectionHint(group)}
                            </span>
                          </span>
                          <span className="customizer-section-trailing">
                            <span className="customizer-panel-badge">
                              {selectedCount}/{max}
                            </span>
                            <span
                              className="customizer-section-chevron"
                              aria-hidden="true"
                            >
                              {isOpen ? "−" : "+"}
                            </span>
                          </span>
                        </button>

                        {isOpen && (
                          <div className="customizer-section-body">
                            <div className="customizer-options customizer-options--checks">
                              {visibleOptions.map(option => {
                                const selected =
                                  customizer.selections[
                                    group.id
                                  ]?.includes(option.id) ?? false
                                const disabled =
                                  group.type === "multi" &&
                                  !selected &&
                                  selectedCount >= max

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={
                                      selected
                                        ? "customizer-option-row is-active"
                                        : disabled
                                        ? "customizer-option-row is-disabled"
                                        : "customizer-option-row"
                                    }
                                    onClick={() => {
                                      if (disabled) return
                                      if (group.type === "single") {
                                        const canClear =
                                          groupSelectionMin(group) === 0
                                        updateCustomizerSelection(
                                          group.id,
                                          option.id,
                                          selected ? canClear : true
                                        )
                                        return
                                      }

                                      updateCustomizerSelection(
                                        group.id,
                                        option.id,
                                        !selected
                                      )
                                    }}
                                    aria-pressed={selected}
                                  >
                                    <span
                                      className={
                                        customizerImageSrc
                                          ? "customizer-option-thumb"
                                          : "customizer-option-thumb customizer-option-thumb--fallback"
                                      }
                                      aria-hidden="true"
                                    >
                                      {customizerImageSrc ? (
                                        <img
                                          src={customizerImageSrc}
                                          alt=""
                                        />
                                      ) : null}
                                    </span>
                                    <span className="customizer-option-copy">
                                      <span>{option.label}</span>
                                      {option.allergens &&
                                        option.allergens.length > 0 && (
                                          <span className="customizer-option-allergens">
                                            Allergens:{" "}
                                            {option.allergens.join(", ")}
                                          </span>
                                        )}
                                    </span>
                                    {option.priceDelta !== 0 && (
                                      <span className="customizer-option-price">
                                        {option.priceDelta > 0 ? "+" : ""}£
                                        {option.priceDelta.toFixed(2)}
                                      </span>
                                    )}
                                    <span className="customizer-option-end">
                                      {group.type === "single" ? (
                                        <span
                                          className={
                                            selected
                                              ? "customizer-radio is-active"
                                              : "customizer-radio"
                                          }
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <span
                                          className={
                                            selected
                                              ? "customizer-check-mark is-inline is-active"
                                              : "customizer-check-mark is-inline"
                                          }
                                          aria-hidden="true"
                                        />
                                      )}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>

                            {pageCount > 1 && (
                              <div className="customizer-pager-row">
                                <button
                                  type="button"
                                  className="customizer-more-btn"
                                  onClick={() =>
                                    setCustomizerOptionPages(current => ({
                                      ...current,
                                      [group.id]: clampIndex(
                                        page - 1,
                                        pageCount
                                      ),
                                    }))
                                  }
                                  disabled={page <= 0}
                                >
                                  Previous options
                                </button>
                                <span className="customizer-pager-state">
                                  {page + 1}/{pageCount}
                                </span>
                                <button
                                  type="button"
                                  className="customizer-more-btn"
                                  onClick={() =>
                                    setCustomizerOptionPages(current => ({
                                      ...current,
                                      [group.id]: clampIndex(
                                        page + 1,
                                        pageCount
                                      ),
                                    }))
                                  }
                                  disabled={page >= pageCount - 1}
                                >
                                  More options
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })
                ) : (
                  <p className="customizer-pane-empty">
                    No customization options for this item.
                  </p>
                )}

                {customizerLayout.includedLines.length > 0 && (
                  <article
                    className={
                      expandedSectionId === 'included'
                        ? "customizer-section-card is-open"
                        : "customizer-section-card"
                    }
                  >
                    <button
                      type="button"
                      className="customizer-section-trigger"
                      onClick={() => toggleSection('included')}
                      aria-expanded={expandedSectionId === 'included'}
                    >
                      <span className="customizer-section-copy">
                        <span className="customizer-group-label">
                          Included ingredients
                        </span>
                        <span className="customizer-group-meta">
                          Tap to review what is included by default.
                        </span>
                      </span>
                      <span className="customizer-section-trailing">
                        <span className="customizer-panel-badge">
                          {customizerLayout.includedLines.length}
                        </span>
                        <span
                          className="customizer-section-chevron"
                          aria-hidden="true"
                        >
                          {expandedSectionId === 'included' ? "−" : "+"}
                        </span>
                      </span>
                    </button>
                    {expandedSectionId === 'included' && (
                      <div className="customizer-section-body">
                        <div className="customizer-included-grid">
                          {customizerLayout.includedLines
                            .slice(0, INCLUDED_PAGE_SIZE)
                            .map(ingredient => (
                              <span
                                key={ingredient}
                                className="customizer-ingredient-chip"
                              >
                                {ingredient}
                              </span>
                            ))}
                        </div>
                        {customizerLayout.includedLines.length >
                          INCLUDED_PAGE_SIZE && (
                          <p className="customizer-pane-copy">
                            +{" "}
                            {customizerLayout.includedLines.length -
                              INCLUDED_PAGE_SIZE}{" "}
                            more included ingredients
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )}

                <article
                  className={
                    expandedSectionId === 'allergens'
                      ? "customizer-section-card is-open"
                      : "customizer-section-card"
                  }
                >
                  <button
                    type="button"
                    className="customizer-section-trigger"
                    onClick={() => toggleSection('allergens')}
                    aria-expanded={expandedSectionId === 'allergens'}
                  >
                    <span className="customizer-section-copy">
                      <span className="customizer-group-label">
                        Allergy requests
                      </span>
                      <span className="customizer-group-meta">
                        Important information before ordering.
                      </span>
                    </span>
                    <span className="customizer-section-trailing">
                      <span className="customizer-panel-badge">
                        {customizerAllergens.length}
                      </span>
                      <span
                        className="customizer-section-chevron"
                        aria-hidden="true"
                      >
                        {expandedSectionId === 'allergens' ? "−" : "+"}
                      </span>
                    </span>
                  </button>
                  {expandedSectionId === 'allergens' && (
                    <div className="customizer-section-body">
                      <p className="customizer-disclosure-copy">
                        {ALLERGY_NOTICE_TEXT}
                      </p>
                      {customizerAllergens.length > 0 && (
                        <div className="customizer-allergen-chip-wrap">
                          {customizerAllergens.map(allergen => (
                            <span
                              key={allergen}
                              className="customizer-allergen-chip"
                            >
                              {allergen}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              </section>
            </div>

            {customizerError && (
              <div className="customizer-error" role="status" aria-live="polite">
                {customizerError}
              </div>
            )}

            {requiredRemaining > 0 && (
              <div className="customizer-error" role="status" aria-live="polite">
                Select required options in {requiredRemaining}{" "}
                {requiredRemaining === 1 ? "group" : "groups"} before
                adding.
              </div>
            )}

            <footer className="customizer-footer">
              <div className="customizer-qty-control">
                <button
                  type="button"
                  className="menu-qty-btn"
                  onClick={() =>
                    setCustomizer(current =>
                      current
                        ? {
                            ...current,
                            quantity: Math.max(1, current.quantity - 1),
                          }
                        : current
                    )
                  }
                  disabled={customizer.quantity <= 1}
                >
                  −
                </button>
                <div className="menu-qty-value">{customizer.quantity}</div>
                <button
                  type="button"
                  className="menu-qty-btn"
                  onClick={() =>
                    setCustomizer(current =>
                      current
                        ? {
                            ...current,
                            quantity: Math.min(20, current.quantity + 1),
                          }
                        : current
                    )
                  }
                >
                  +
                </button>
              </div>

              <div className="customizer-footer-total">
                <span>Total</span>
                <strong>
                  £{(customizerUnitPrice * customizer.quantity).toFixed(2)}
                </strong>
              </div>

              <button
                type="button"
                onClick={closeCustomizer}
                className="customizer-footer-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCustomizedItem}
                disabled={
                  Boolean(customizerValidation && !customizerValidation.ok) ||
                  requiredRemaining > 0
                }
                className="customizer-footer-primary"
              >
                Add to basket • £
                {(customizerUnitPrice * customizer.quantity).toFixed(2)}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
