'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { IngredientEditor } from "@/components/order/IngredientEditor"
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

type DebugEntry = {
  name: string
  ok: boolean
  status?: number
  ms: number
  requestId?: string | null
  attempt?: number
  detail?: string
  time: string
}

type CustomizerGroup = MenuCustomization["groups"][number]

const INCLUDED_PAGE_SIZE = 8
const ALLERGY_NOTICE_TEXT =
  "Allergen information is available on request. Our kitchen handles common allergens, so traces may be present."


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
  const [customizerDragOffset, setCustomizerDragOffset] = useState(0)
  const [customizerError, setCustomizerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string>('unknown')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([])
  const [debugCopyStatus, setDebugCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const cartByKeyRef = useRef<Record<string, CartItem>>({})
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingSyncEntry>>({})
  const customizerTouchStartYRef = useRef<number | null>(null)
  const lastRequestIdRef = useRef<string>('unknown')
  const menuViewTrackedRef = useRef(false)
  const lastCategoryTrackedRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const errorStickyUntilRef = useRef<number>(0)
  const errorClearTimerRef = useRef<number | null>(null)
  // Circuit breaker: prevent cascading retries after repeated failures
  const circuitBreakerRef = useRef<{
    sessionConsecutiveFailures: number
    sessionCircuitOpenUntil: number
    cartConsecutiveFailures: Record<string, number>
    cartCircuitOpenUntil: Record<string, number>
  }>({
    sessionConsecutiveFailures: 0,
    sessionCircuitOpenUntil: 0,
    cartConsecutiveFailures: {},
    cartCircuitOpenUntil: {},
  })

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  useEffect(() => {
    cartByKeyRef.current = cartByKey
  }, [cartByKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setDebugEnabled(params.has('debug'))
  }, [])

  const logDebug = useCallback((entry: Omit<DebugEntry, 'time'>) => {
    if (!debugEnabled) return
    const payload: DebugEntry = {
      ...entry,
      time: new Date().toISOString(),
    }
    setDebugEntries(prev => {
      const next = [payload, ...prev].slice(0, 50)
      if (typeof window !== 'undefined') {
        ;(window as unknown as { __NFC_DEBUG_LOGS?: DebugEntry[] }).__NFC_DEBUG_LOGS = next
      }
      return next
    })
    console.info('[nfc-debug]', payload)
  }, [debugEnabled])

  const notifyHeader = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('nfc-cart-updated'))
  }

  useEffect(() => {
    notifyHeader()
  }, [cartByKey])

  const setErrorSticky = useCallback((next: string | null) => {
    const now = Date.now()
    if (errorClearTimerRef.current) {
      window.clearTimeout(errorClearTimerRef.current)
      errorClearTimerRef.current = null
    }

    if (next) {
      errorStickyUntilRef.current = now + 3000
      setError(next)
      return
    }

    const remaining = errorStickyUntilRef.current - now
    if (remaining > 0) {
      errorClearTimerRef.current = window.setTimeout(() => {
        errorClearTimerRef.current = null
        setError(null)
      }, remaining)
      return
    }

    setError(null)
  }, [])

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
    setCustomizerDragOffset(0)
  }, [customizer?.item.id])

  const loadCart = async (sid: string, isInitialLoad = false) => {
    const activeClientKey = ensureClientKey()
    const cb = circuitBreakerRef.current

    // Circuit breaker: if too many recent failures, back off exponentially
    if (cb.cartCircuitOpenUntil[sid] && cb.cartCircuitOpenUntil[sid] > Date.now()) {
      logDebug({
        name: 'cart.get',
        ok: false,
        ms: 0,
        detail: 'circuit_breaker_open',
      })
      return false
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const startedAt = Date.now()
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

        logDebug({
          name: 'cart.get',
          ok: res.ok,
          status: res.status,
          ms: Date.now() - startedAt,
          requestId,
          attempt,
          detail: isInitialLoad ? 'initial' : 'poll',
        })

        if (!res.ok) {
          // Increment failure counter and open circuit if needed
          cb.cartConsecutiveFailures[sid] = (cb.cartConsecutiveFailures[sid] ?? 0) + 1
          const failures = cb.cartConsecutiveFailures[sid]
          
          if (failures >= 3) {
            // After 3 consecutive failures, open circuit for 10s exponentially
            const backoffMs = 10000 * Math.pow(2, Math.min(failures - 3, 2))
            cb.cartCircuitOpenUntil[sid] = Date.now() + backoffMs
          }

          if (attempt === 0) continue
          if (isInitialLoad) {
            const errorInfo = await readApiErrorInfo(res)
            setErrorSticky(cartLoadErrorMessage(errorInfo))
          }
          return false
        }

        // Success: reset circuit breaker
        cb.cartConsecutiveFailures[sid] = 0
        cb.cartCircuitOpenUntil[sid] = 0

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
        // Clear cart/basket/session errors on successful load
        if (error) {
          const lower = error.toLowerCase()
          if (
            lower.includes('basket') ||
            lower.includes('cart') ||
            lower.includes('session')
          ) {
            setErrorSticky(null)
          }
        }
        return true
      } catch (err) {
        logDebug({
          name: 'cart.get',
          ok: false,
          ms: 0,
          attempt,
          detail: err instanceof Error ? err.message : 'network_error',
        })
        if (attempt === 0) continue
        if (isInitialLoad) {
          setErrorSticky(networkErrorMessage('open your basket'))
        }
        return false
      }
    }

    return false
  }

  const loadMenu = async () => {
    try {
      const startedAt = Date.now()
      const res = await fetch('/api/menu')
      const requestId = res.headers.get('x-request-id')
      if (requestId) {
        lastRequestIdRef.current = requestId
      }
      logDebug({
        name: 'menu.get',
        ok: res.ok,
        status: res.status,
        ms: Date.now() - startedAt,
        requestId,
      })
      if (!res.ok) {
        const errorInfo = await readApiErrorInfo(res)
        setErrorSticky(menuLoadErrorMessage(errorInfo))
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
      if (error && error.toLowerCase().includes('menu')) {
        setErrorSticky(null)
      }
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
      logDebug({
        name: 'menu.get',
        ok: false,
        ms: 0,
        detail: 'network_error',
      })
      setErrorSticky(networkErrorMessage('load the menu'))
    } finally {
      setMenuLoading(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const connectSession = useCallback(async (tagId: string) => {
    let lastError: string | null = null
    const cb = circuitBreakerRef.current

    // Circuit breaker: if recent failures, apply exponential backoff
    if (cb.sessionCircuitOpenUntil > Date.now()) {
      logDebug({
        name: 'session.post',
        ok: false,
        ms: 0,
        detail: 'circuit_breaker_open',
      })
      if (isMountedRef.current) {
        setLoading(false)
        setErrorSticky('Service temporarily overloaded. Retrying in a moment...')
      }
      return
    }

    setLoading(true)
    if (error && error.toLowerCase().includes('connect')) {
      setErrorSticky(null)
    }

    // Retry session creation up to 5 times with exponential backoff (300ms, 600ms, 1.2s, 2.4s, 4.8s)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        const startedAt = Date.now()

        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        const requestId = res.headers.get('x-request-id')
        if (requestId) {
          lastRequestIdRef.current = requestId
        }

        logDebug({
          name: 'session.post',
          ok: res.ok,
          status: res.status,
          ms: Date.now() - startedAt,
          requestId,
          attempt,
        })

        if (!res.ok) {
          // Increment failure counter and open circuit if needed
          cb.sessionConsecutiveFailures += 1
          const failures = cb.sessionConsecutiveFailures

          if (failures >= 3) {
            // After 3 consecutive failures, open circuit and back off exponentially
            const backoffMs = 15000 * Math.pow(2, Math.min(failures - 3, 2))
            cb.sessionCircuitOpenUntil = Date.now() + backoffMs
          }

          const errorInfo = await readApiErrorInfo(res)
          if (res.status === 409 && errorInfo.code === 'TABLE_CLOSED') {
            if (isMountedRef.current) {
              setLoading(false)
              router.replace(
                tenantTagPath(pathname, tagId, "/closed")
              )
            }
            return
          }
          lastError = sessionConnectErrorMessage(errorInfo, tagId)
          if (attempt < 4) {
            const delay = 300 * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          if (isMountedRef.current) {
            setLoading(false)
            setErrorSticky(lastError)
          }
          return
        }

        // Success: reset circuit breaker and consecutive failures
        cb.sessionConsecutiveFailures = 0
        cb.sessionCircuitOpenUntil = 0

        const payload = await res.json()
        if (!isMountedRef.current) return

        const sid = payload.sessionId as string
        setSessionId(sid)
        setGlobalSession(sid, 'customer')
        await loadCart(sid, true)
        if (isMountedRef.current) {
          setLoading(false)
        }
        return
      } catch (err) {
        logDebug({
          name: 'session.post',
          ok: false,
          ms: 0,
          attempt,
          detail: err instanceof Error ? err.message : 'network_error',
        })

        cb.sessionConsecutiveFailures += 1
        const failures = cb.sessionConsecutiveFailures
        if (failures >= 3) {
          const backoffMs = 15000 * Math.pow(2, Math.min(failures - 3, 2))
          cb.sessionCircuitOpenUntil = Date.now() + backoffMs
        }

        lastError = networkErrorMessage('connect this table')
        if (attempt < 4) {
          const delay = 300 * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        if (isMountedRef.current) {
          setLoading(false)
          setErrorSticky(lastError)
        }
        return
      }
    }
  }, [error, loadCart, pathname, router, setErrorSticky, setGlobalSession])

  useEffect(() => {
    ensureClientKey()
  }, [ensureClientKey])

  useEffect(() => {
    void connectSession(params.tagId)
  }, [connectSession, params.tagId])

  useEffect(() => {
    void loadMenu()
    // Menu is static; only load once. If item is 86'd, customer sees it when they try to order.
    // Manual refresh available via button if needed.
  }, [params.tagId])

  useEffect(() => {
    if (!sessionId) return

    // Poll cart frequently since it changes with customer actions
    const interval = window.setInterval(() => {
      void loadCart(sessionId)
    }, 5000)

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

    setCustomizer({
      item,
      quantity: 1,
      selections: defaultSelections,
    })
    setCustomizerError(null)
    trackEvent('item_opened', {
      restaurantId,
      requestId: lastRequestIdRef.current,
      menuItemId: item.id,
    })
  }

  const closeCustomizer = () => {
    setCustomizer(null)
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
        includedLines: [] as Array<{ label: string; ingredientId: string }>,
      }
    }

    const customization = customizer.item.customization
    const groups = customization.groups
    const baseIngredientIds = customization.baseIngredientIds ?? []
    const labels = getBaseIngredientLabels(customization)

    // Map ingredient IDs to labels (they're in the same order)
    const includedLines = baseIngredientIds.slice(0, labels.length).map((id, idx) => ({
      label: labels[idx],
      ingredientId: id,
    }))

    return {
      groups,
      includedLines,
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
      void loadCart(sessionId, true)
    } else {
      void connectSession(params.tagId)
    }
    void loadMenu()
  }

  const isRetrying = loading || menuLoading

  if (menuLoading) {
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
      {debugEnabled && debugEntries.length > 0 && (
        <div className="debug-panel" role="status" aria-live="polite">
          <div className="debug-panel-header">
            <div className="debug-panel-title">Debug: Network</div>
            <button
              type="button"
              className="debug-panel-copy"
              onClick={async () => {
                try {
                  const payload = JSON.stringify(debugEntries, null, 2)
                  if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(payload)
                  } else {
                    const textArea = document.createElement('textarea')
                    textArea.value = payload
                    textArea.style.position = 'fixed'
                    textArea.style.opacity = '0'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textArea)
                  }
                  setDebugCopyStatus('copied')
                  window.setTimeout(() => setDebugCopyStatus('idle'), 1500)
                } catch {
                  setDebugCopyStatus('failed')
                  window.setTimeout(() => setDebugCopyStatus('idle'), 1500)
                }
              }}
            >
              {debugCopyStatus === 'copied'
                ? 'Copied'
                : debugCopyStatus === 'failed'
                ? 'Copy failed'
                : 'Copy logs'}
            </button>
          </div>
          <div className="debug-panel-list">
            {debugEntries.map((entry, idx) => (
              <div key={`${entry.time}-${idx}`} className="debug-panel-row">
                <span className="debug-panel-name">{entry.name}</span>
                <span className={entry.ok ? "debug-panel-ok" : "debug-panel-fail"}>
                  {entry.ok ? "OK" : "FAIL"}
                </span>
                <span className="debug-panel-ms">{entry.ms}ms</span>
                {entry.status ? (
                  <span className="debug-panel-status">{entry.status}</span>
                ) : null}
                {entry.requestId ? (
                  <span className="debug-panel-req">{entry.requestId}</span>
                ) : null}
                {entry.detail ? (
                  <span className="debug-panel-detail">{entry.detail}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !sessionId && (
        <div className="menu-lock-banner">
          Connecting your table...
        </div>
      )}

      {error && (
        <div className="menu-lock-banner menu-lock-banner--error">
          <div className="flex items-center gap-2">
            <span className="menu-error-icon">i</span>
            <span>{error}</span>
            {isRetrying && <span className="menu-error-spinner" aria-hidden="true" />}
          </div>
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
              <button
                type="button"
                onClick={closeCustomizer}
                className="customizer-close-btn"
                aria-label="Close item details"
              >
                ×
              </button>
              <div className="customizer-top-body">
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
                  <h2 id={customizerTitleId} className="customizer-title">
                    {customizer.item.name}
                  </h2>
                  <p
                    id={customizerDescriptionId}
                    className="customizer-description customizer-description--compact"
                  >
                    {customizer.item.description ||
                      "Customize ingredients and quantity before adding to your order."}
                  </p>
                </div>
              </div>
            </header>

            <div className="customizer-stage customizer-stage--single">
              <section className="customizer-pane customizer-pane--stack">
                {customizer.item.customization && (
                  <IngredientEditor
                    customization={customizer.item.customization}
                    selections={customizer.selections}
                    onSelectionChange={updateCustomizerSelection}
                  />
                )}

                {customizerAllergens.length > 0 && (
                  <div className="customizer-allergen-section">
                    <div className="customizer-allergen-label">
                      Allergens
                    </div>
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
                  </div>
                )}

                {!customizer.item.customization && (
                  <p className="customizer-pane-empty">
                    No ingredients to customize for this item.
                  </p>
                )}

                <div className="customizer-spacer" />
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
              <div className="customizer-footer-row">
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
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
