'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function TagPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()
  const setGlobalSession = useSessionStore(s => s.setSession)
  const ensureClientKey = useSessionStore(s => s.ensureClientKey)

  const [menu, setMenu] = useState<MenuSectionType[]>([])
  const [menuLocked, setMenuLocked] = useState(false)
  const [menuLoading, setMenuLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cartByKey, setCartByKey] = useState<Record<string, CartItem>>({})
  const [customizer, setCustomizer] = useState<CustomizerState | null>(null)
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
            router.replace(`/t/${params.tagId}/closed`)
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

  const customizerGroupedSelections = useMemo(() => {
    if (!customizer || !hasCustomization(customizer.item.customization)) {
      return {
        mandatoryGroups: [] as MenuCustomization["groups"],
        optionalGroups: [] as MenuCustomization["groups"],
        includedLines: [] as string[],
        defaultChoiceLines: [] as string[],
      }
    }

    const customization = customizer.item.customization
    const mandatoryGroups = customization.groups.filter(group => {
      const min =
        typeof group.min === 'number'
          ? group.min
          : group.required
          ? 1
          : 0
      return min > 0 || group.required === true
    })
    const optionalGroups = customization.groups.filter(
      group => !mandatoryGroups.some(value => value.id === group.id)
    )

    const includedLines = getBaseIngredientLabels(customization)
    const defaultChoiceLines = buildModifierSummary(
      customization,
      defaultModifierSelections(customization)
    )

    return {
      mandatoryGroups,
      optionalGroups,
      includedLines,
      defaultChoiceLines,
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
        <div className="modal-overlay">
          <div className="w-full max-w-md">
            <div className="card space-y-3 customizer-sheet">
              <div className="customizer-title">
                {customizer.item.name}
              </div>
              {customizer.item.description && (
                <div className="customizer-description">
                  {customizer.item.description}
                </div>
              )}

              {customizerGroupedSelections.includedLines.length > 0 && (
                <div className="customizer-info-block">
                  <div className="customizer-info-title">
                    Included
                  </div>
                  <div className="customizer-list">
                    {customizerGroupedSelections.includedLines.map(line => (
                      <div key={line} className="customizer-list-row">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customizerGroupedSelections.defaultChoiceLines.length > 0 && (
                <div className="customizer-info-block">
                  <div className="customizer-info-title">
                    Default choices
                  </div>
                  <div className="customizer-list">
                    {customizerGroupedSelections.defaultChoiceLines.map(line => (
                      <div key={line} className="customizer-list-row">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customizerGroupedSelections.mandatoryGroups.length > 0 && (
                <div className="customizer-info-block">
                  <div className="customizer-info-title">
                    Mandatory selections
                  </div>
                  <div className="customizer-chip-wrap">
                    {customizerGroupedSelections.mandatoryGroups.map(group => (
                      <span key={group.id} className="customizer-chip">
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {customizerGroupedSelections.optionalGroups.length > 0 && (
                <div className="customizer-info-block">
                  <div className="customizer-info-title">
                    Optional additions
                  </div>
                  <div className="customizer-chip-wrap">
                    {customizerGroupedSelections.optionalGroups.map(group => (
                      <span key={group.id} className="customizer-chip">
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!hasCustomization(customizer.item.customization) && (
                <div className="customizer-info-block">
                  <div className="customizer-info-title">
                    Item options
                  </div>
                  <div className="customizer-list-row">
                    {resolveEditPolicy(customizer.item.customization) === "none"
                      ? "No substitutions configured for this item."
                      : "No additional options for this item."}
                  </div>
                </div>
              )}

              {hasCustomization(customizer.item.customization) &&
                customizer.item.customization.groups.map(group => {
                  const selected = customizer.selections[group.id] ?? []
                  const min =
                    typeof group.min === 'number'
                      ? group.min
                      : group.required
                      ? 1
                      : 0
                  const max =
                    typeof group.max === 'number'
                      ? group.max
                      : group.type === 'single'
                      ? 1
                      : group.options.length

                  return (
                    <div key={group.id} className="customizer-group">
                      <div className="customizer-group-head">
                        <div className="customizer-group-label">{group.name}</div>
                        <div className="customizer-group-meta">
                          {min > 0 ? `Required · ` : "Optional · "}
                          {group.type === 'single'
                            ? 'Choose 1'
                            : `Choose ${min}${max > min ? `-${max}` : ''}`}
                        </div>
                      </div>
                      <div className="customizer-options">
                        {group.options.map(option => {
                          const active = selected.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={
                                active
                                  ? 'customizer-option active'
                                  : 'customizer-option'
                              }
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
                                {option.allergens && option.allergens.length > 0 && (
                                  <span className="customizer-option-allergens">
                                    Allergens: {option.allergens.join(', ')}
                                  </span>
                                )}
                              </span>
                              {option.priceDelta !== 0 && (
                                <span className="customizer-option-price">
                                  {option.priceDelta > 0 ? '+' : ''}£
                                  {option.priceDelta.toFixed(2)}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

              <div className="customizer-allergen-banner">
                Allergens:{" "}
                {customizerAllergens.length > 0
                  ? customizerAllergens.join(", ")
                  : "none"}
              </div>

              <div className="customizer-qty-row">
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
                <div className="customizer-total">
                  £{(customizerUnitPrice * customizer.quantity).toFixed(2)}
                </div>
              </div>

              {customizerError && (
                <div className="customizer-error">{customizerError}</div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeCustomizer}
                  className="px-3 py-2 rounded text-sm font-medium btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCustomizedItem}
                  disabled={Boolean(customizerValidation && !customizerValidation.ok)}
                  className="px-3 py-2 rounded text-sm font-medium btn-primary"
                >
                  Add to order £{(customizerUnitPrice * customizer.quantity).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
