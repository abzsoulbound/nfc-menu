'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  resolveEditPolicy,
  type MenuCustomization,
  type ModifierSelections,
  validateModifierSelections,
} from "@/lib/menuCustomizations"
import { tenantTagPath } from "@/lib/tenantPaths"

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

type CustomizerSectionKey = "removals" | "additions" | "allergens"
type CustomizerGroup = MenuCustomization["groups"][number]

type CustomizerSection = {
  key: CustomizerSectionKey
  title: string
  hint: string
  groups: CustomizerGroup[]
  selectedCount: number
  maxCount: number
}

const INCLUDED_PREVIEW_COUNT = 6
const GROUP_OPTION_PREVIEW_COUNT = 3

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

function classifyGroup(group: CustomizerGroup): CustomizerSectionKey {
  const haystack = `${group.id} ${group.name}`.toLowerCase()
  const hasRemovalOptions = group.options.some(
    option => (option.removeIngredientIds?.length ?? 0) > 0
  )

  if (
    haystack.includes("remove") ||
    haystack.includes("without") ||
    hasRemovalOptions
  ) {
    return "removals"
  }

  if (
    /allergen|allergy|diet|intolerance|gluten|dairy|nut|vegan|vegetarian|halal|kosher/.test(
      haystack
    )
  ) {
    return "allergens"
  }

  return "additions"
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
  const [showAllIncluded, setShowAllIncluded] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [customizerError, setCustomizerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cartByKeyRef = useRef<Record<string, CartItem>>({})
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingSyncEntry>>({})

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
    setShowAllIncluded(false)
    setExpandedGroups({})
  }, [customizer?.item.id])

  const loadCart = async (sid: string) => {
    try {
      const activeClientKey = ensureClientKey()
      const res = await fetch('/api/cart/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          clientKey: activeClientKey,
        }),
      })

      if (!res.ok) {
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
        (current.toLowerCase().includes('cart') ||
          current.toLowerCase().includes('session'))
          ? null
          : current
      )
      return true
    } catch {
      setError(networkErrorMessage('load your cart'))
      return false
    }
  }

  const loadMenu = async () => {
    try {
      const res = await fetch('/api/menu', {
        cache: 'no-store',
      })
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
        setError(syncError ?? 'Could not sync cart. Refreshing your cart now.')
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

    setCustomizer({
      item,
      quantity: 1,
      selections: defaultModifierSelections(item.customization),
    })
    setCustomizerError(null)
  }

  const closeCustomizer = () => {
    setCustomizer(null)
    setCustomizerError(null)
  }

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(current => ({
      ...current,
      [groupId]: !current[groupId],
    }))
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
    const sectionMeta: Array<Omit<CustomizerSection, "groups" | "selectedCount" | "maxCount">> = [
      {
        key: "removals",
        title: "Removals",
        hint: "Turn ingredients off with one tap.",
      },
      {
        key: "additions",
        title: "Additions",
        hint: "Extras and substitutions for this dish.",
      },
      {
        key: "allergens",
        title: "Allergens",
        hint: "Dietary-related switches, if available.",
      },
    ]

    if (!customizer || !hasCustomization(customizer.item.customization)) {
      return {
        includedLines: [] as string[],
        defaultChoiceLines: [] as string[],
        sections: sectionMeta.map(section => ({
          ...section,
          groups: [] as CustomizerGroup[],
          selectedCount: 0,
          maxCount: 0,
        })),
      }
    }

    const customization = customizer.item.customization
    const buckets: Record<CustomizerSectionKey, CustomizerGroup[]> = {
      removals: [],
      additions: [],
      allergens: [],
    }

    for (const group of customization.groups) {
      buckets[classifyGroup(group)].push(group)
    }

    const sections = sectionMeta.map(section => {
      const groups = buckets[section.key]
      const selectedCount = groups.reduce(
        (total, group) =>
          total + (customizer.selections[group.id]?.length ?? 0),
        0
      )
      const maxCount = groups.reduce(
        (total, group) => total + groupSelectionMax(group),
        0
      )

      return {
        ...section,
        groups,
        selectedCount,
        maxCount,
      }
    })

    return {
      includedLines: getBaseIngredientLabels(customization),
      defaultChoiceLines: buildModifierSummary(
        customization,
        defaultModifierSelections(customization)
      ),
      sections,
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

  const customizerTitleId = customizer
    ? `customizer-title-${customizer.item.id}`
    : 'customizer-title'
  const customizerDescriptionId = customizer
    ? `customizer-description-${customizer.item.id}`
    : 'customizer-description'
  const customizerImageSrc = customizer?.item.image ?? '/images/replace.png'

  if (loading || menuLoading) {
    return (
      <div className="order-page">
        <div className="menu-empty-state">Connecting your table...</div>
      </div>
    )
  }

  return (
    <div className="menu-page">
      {error && (
        <div className="menu-lock-banner">{error}</div>
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
          >
            <header className="customizer-hero">
              <img
                className="customizer-hero-image"
                src={customizerImageSrc}
                alt={`${customizer.item.name} preview`}
                onError={event => {
                  const el = event.currentTarget
                  if (el.dataset.fallbackApplied === "1") return
                  el.dataset.fallbackApplied = "1"
                  el.src = '/images/replace.png'
                }}
              />
              <button
                type="button"
                onClick={closeCustomizer}
                className="customizer-close-btn"
                aria-label="Close item details"
              >
                X
              </button>
            </header>

            <div className="customizer-scroll">
              <section className="customizer-summary">
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
                  className="customizer-description"
                >
                  {customizer.item.description ||
                    "Customize ingredients and quantity before adding to your order."}
                </p>

                {customizerLayout.defaultChoiceLines.length > 0 && (
                  <div className="customizer-default-wrap" aria-label="Default choices">
                    {customizerLayout.defaultChoiceLines.map(line => (
                      <span key={line} className="customizer-default-chip">
                        {line}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section
                className="customizer-panel"
                aria-labelledby="included-ingredients-heading"
              >
                <div className="customizer-panel-head">
                  <h3
                    id="included-ingredients-heading"
                    className="customizer-panel-title"
                  >
                    Included Ingredients
                  </h3>
                  <span className="customizer-panel-badge">
                    {customizerLayout.includedLines.length}
                  </span>
                </div>

                {customizerLayout.includedLines.length > 0 ? (
                  <>
                    <div className="customizer-ingredient-grid">
                      {(showAllIncluded
                        ? customizerLayout.includedLines
                        : customizerLayout.includedLines.slice(0, INCLUDED_PREVIEW_COUNT)
                      ).map(line => (
                        <span key={line} className="customizer-ingredient-chip">
                          {line}
                        </span>
                      ))}
                    </div>
                    {customizerLayout.includedLines.length > INCLUDED_PREVIEW_COUNT && (
                      <button
                        type="button"
                        className="customizer-more-btn"
                        onClick={() => setShowAllIncluded(current => !current)}
                        aria-expanded={showAllIncluded}
                      >
                        {showAllIncluded
                          ? "Show fewer ingredients"
                          : `Show all ingredients (${customizerLayout.includedLines.length - INCLUDED_PREVIEW_COUNT} more)`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="customizer-empty-copy">
                    Ingredient list is currently unavailable for this item.
                  </p>
                )}
              </section>

              <section
                className="customizer-panel"
                aria-labelledby="customizations-heading"
              >
                <div className="customizer-panel-head">
                  <h3 id="customizations-heading" className="customizer-panel-title">
                    Customizations
                  </h3>
                  <span className="customizer-panel-badge">
                    {customizerLayout.sections.reduce(
                      (total, section) => total + section.groups.length,
                      0
                    )} groups
                  </span>
                </div>
                <p className="customizer-panel-caption">
                  Most common choices are shown first. Expand a group to see every option.
                </p>

                {!hasCustomization(customizer.item.customization) && (
                  <p className="customizer-empty-copy">
                    {resolveEditPolicy(customizer.item.customization) === "none"
                      ? "No substitutions are configured for this item."
                      : "No additional options are available right now."}
                  </p>
                )}

                {hasCustomization(customizer.item.customization) && (
                  <div className="customizer-section-stack">
                    {customizerLayout.sections.map(section => {
                      if (section.groups.length === 0) return null

                      return (
                        <section
                          key={section.key}
                          className="customizer-group-section"
                          aria-labelledby={`customizer-section-${section.key}`}
                        >
                          <div className="customizer-group-section-head">
                            <h4
                              id={`customizer-section-${section.key}`}
                              className="customizer-group-section-title"
                            >
                              {section.title}
                            </h4>
                            <span className="customizer-group-section-count">
                              {section.selectedCount} selected
                            </span>
                          </div>
                          <p className="customizer-group-section-hint">
                            {section.hint}
                          </p>

                          <div className="customizer-group-list">
                            {section.groups.map(group => {
                              const selected = customizer.selections[group.id] ?? []
                              const min = groupSelectionMin(group)
                              const max = groupSelectionMax(group)
                              const requiredUnmet =
                                min > 0 && selected.length < min
                              const isExpanded = Boolean(expandedGroups[group.id])
                              const collapsedOptions = group.options.filter(
                                (option, index) =>
                                  index < GROUP_OPTION_PREVIEW_COUNT ||
                                  selected.includes(option.id)
                              )
                              const visibleOptions = isExpanded
                                ? group.options
                                : collapsedOptions
                              const hiddenCount = Math.max(
                                0,
                                group.options.length - collapsedOptions.length
                              )
                              const maxReached =
                                group.type === "multi" &&
                                selected.length >= max

                              return (
                                <fieldset key={group.id} className="customizer-group-card">
                                  <legend className="customizer-sr-only">
                                    {group.name}
                                  </legend>
                                  <div className="customizer-group-head">
                                    <div>
                                      <div className="customizer-group-label">
                                        {group.name}
                                      </div>
                                      <div className="customizer-group-meta">
                                        {min > 0 ? "Required" : "Optional"} ·{" "}
                                        {group.type === "single"
                                          ? "Choose 1"
                                          : `Choose ${min}${max > min ? `-${max}` : ""}`}
                                      </div>
                                    </div>
                                    <span className="customizer-group-status">
                                      {selected.length} selected
                                      {max > 0 ? ` of ${max}` : ""}
                                      {maxReached ? " (max reached)" : ""}
                                    </span>
                                  </div>

                                  {group.type === "single" &&
                                    min === 0 &&
                                    selected.length > 0 && (
                                      <button
                                        type="button"
                                        className="customizer-clear-btn"
                                        onClick={() =>
                                          updateCustomizerSelection(
                                            group.id,
                                            selected[0],
                                            false
                                          )
                                        }
                                      >
                                        Clear selection
                                      </button>
                                    )}

                                  <div
                                    id={`customizer-options-${group.id}`}
                                    className={
                                      group.type === "single"
                                        ? "customizer-options customizer-options--chips"
                                        : "customizer-options customizer-options--checks"
                                    }
                                  >
                                    {visibleOptions.map(option => {
                                      const active = selected.includes(option.id)
                                      const disabled =
                                        group.type === "multi" &&
                                        !active &&
                                        selected.length >= max

                                      if (group.type === "multi") {
                                        return (
                                          <label
                                            key={option.id}
                                            className={
                                              active
                                                ? "customizer-check-option is-active"
                                                : disabled
                                                ? "customizer-check-option is-disabled"
                                                : "customizer-check-option"
                                            }
                                          >
                                            <input
                                              type="checkbox"
                                              className="customizer-check-input"
                                              checked={active}
                                              disabled={disabled}
                                              onChange={event =>
                                                updateCustomizerSelection(
                                                  group.id,
                                                  option.id,
                                                  event.target.checked
                                                )
                                              }
                                            />
                                            <span
                                              className="customizer-check-mark"
                                              aria-hidden="true"
                                            />
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
                                          </label>
                                        )
                                      }

                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={
                                            active
                                              ? "customizer-chip-option is-active"
                                              : "customizer-chip-option"
                                          }
                                          aria-pressed={active}
                                          onClick={() =>
                                            updateCustomizerSelection(
                                              group.id,
                                              option.id,
                                              !active
                                            )
                                          }
                                        >
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
                                        </button>
                                      )
                                    })}
                                  </div>

                                  {hiddenCount > 0 && (
                                    <button
                                      type="button"
                                      className="customizer-more-btn"
                                      onClick={() => toggleGroupExpansion(group.id)}
                                      aria-expanded={isExpanded}
                                      aria-controls={`customizer-options-${group.id}`}
                                    >
                                      {isExpanded
                                        ? "Show fewer options"
                                        : `More options (${hiddenCount})`}
                                    </button>
                                  )}

                                  {requiredUnmet && (
                                    <div className="customizer-group-warning">
                                      Select at least {min} option
                                      {min > 1 ? "s" : ""}.
                                    </div>
                                  )}
                                </fieldset>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="customizer-panel" aria-labelledby="allergens-heading">
                <div className="customizer-panel-head">
                  <h3 id="allergens-heading" className="customizer-panel-title">
                    Allergens
                  </h3>
                  <span
                    className={
                      customizerAllergens.length > 0
                        ? "customizer-allergen-state customizer-allergen-state--warn"
                        : "customizer-allergen-state"
                    }
                  >
                    {customizerAllergens.length > 0
                      ? `${customizerAllergens.length} present`
                      : "None detected"}
                  </span>
                </div>

                {customizerAllergens.length > 0 ? (
                  <div className="customizer-allergen-chip-wrap">
                    {customizerAllergens.map(allergen => (
                      <span key={allergen} className="customizer-allergen-chip">
                        {allergen}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="customizer-empty-copy">
                    No tracked allergens in the current configuration.
                  </p>
                )}
              </section>

              {customizerError && (
                <div className="customizer-error" role="status" aria-live="polite">
                  {customizerError}
                </div>
              )}
            </div>

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
                disabled={Boolean(customizerValidation && !customizerValidation.ok)}
                className="customizer-footer-primary"
              >
                Add to order
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
