'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import {
  ProductDetail,
  type ProductOptionGroup,
} from "@/components/order/ProductDetail"
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
  optionGroups?: ProductOptionGroup[]
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

function resolveOptionType(
  value: unknown,
  fallbackMulti: boolean
): ProductOptionGroup["type"] {
  if (value === "single" || value === "multi" || value === "adjustable") {
    return value
  }
  return fallbackMulti ? "multi" : "single"
}

function ingredientBaseLabel(value: string): string {
  return value
    .replace(/^\s*(no|extra)\s+/i, "")
    .trim()
}

function ingredientLabelFromId(ingredientId: string): string {
  return ingredientId
    .replace(/_/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase())
}

function actionLabelForGroup(group: {
  id: string
  title: string
  type: ProductOptionGroup["type"]
}): string {
  const idTitle = `${group.id} ${group.title}`.toLowerCase()
  if (idTitle.includes("substitute") || group.type === "adjustable") {
    return "Replace"
  }
  if (group.type === "multi") return "Choose"
  return "Select"
}

function normalizeItemOptionGroups(item: MenuItem): ProductOptionGroup[] {
  if (Array.isArray(item.optionGroups) && item.optionGroups.length > 0) {
    return item.optionGroups.map(group => {
      const type = resolveOptionType(group.type, Boolean(group.multiSelect))
      const options = Array.isArray(group.options)
        ? group.options.map(option => ({
            id: String(option.id),
            name: String(option.name),
            priceDelta: Number(option.priceDelta ?? 0),
            sourceGroupId: String(group.id),
            sourceOptionId: String(option.id),
          }))
        : []

      const normalizedOptions =
        type === "adjustable" && options.length > 0
          ? options.some(option => option.name.toLowerCase().includes("normal"))
            ? options
            : [{ id: `${group.id}:normal`, name: "Normal", priceDelta: 0 }, ...options]
          : options

      return {
        id: String(group.id),
        title: String(group.title),
        required: Boolean(group.required),
        multiSelect: type === "multi",
        type,
        min:
          typeof (group as { min?: unknown }).min === "number"
            ? Number((group as { min?: number }).min)
            : undefined,
        max:
          typeof (group as { max?: unknown }).max === "number"
            ? Number((group as { max?: number }).max)
            : undefined,
        actionLabel: actionLabelForGroup({
          id: String(group.id),
          title: String(group.title),
          type,
        }),
        options: normalizedOptions,
      }
    })
  }

  if (!hasCustomization(item.customization)) {
    return []
  }

  const hiddenSystemGroupIds = new Set(["remove_ingredients", "extra_ingredients"])
  const groups = item.customization.groups
  const replacementGroups = groups.filter(group => {
    if (hiddenSystemGroupIds.has(group.id)) {
      return false
    }
    return group.options.some(
      option =>
        (option.removeIngredientIds?.length ?? 0) > 0 &&
        (option.ingredientIds?.length ?? 0) > 0
    )
  })

  const ingredientAdjustables: ProductOptionGroup[] =
    replacementGroups.length > 0
      ? (() => {
          const byIngredient = new Map<
            string,
            {
              title: string
              replaceOptions: Array<{
                id: string
                name: string
                priceDelta: number
                sourceGroupId?: string
                sourceOptionId?: string
              }>
            }
          >()

          for (const group of replacementGroups) {
            for (const option of group.options) {
              const removedIds = option.removeIngredientIds ?? []
              if (removedIds.length === 0) continue

              for (const removedIngredientId of removedIds) {
                const key = removedIngredientId.toLowerCase()
                const existing =
                  byIngredient.get(key) ??
                  {
                    title: ingredientLabelFromId(removedIngredientId),
                    replaceOptions: [],
                  }

                const replaceOption = {
                  id: `${group.id}:${option.id}:replace:${removedIngredientId}`,
                  name: `Replace with ${option.label}`,
                  priceDelta: Number(option.priceDelta ?? 0),
                  sourceGroupId: group.id,
                  sourceOptionId: option.id,
                }

                const dedupeKey = `${replaceOption.sourceGroupId}:${replaceOption.sourceOptionId}`
                if (
                  !existing.replaceOptions.some(
                    value => `${value.sourceGroupId}:${value.sourceOptionId}` === dedupeKey
                  )
                ) {
                  existing.replaceOptions.push(replaceOption)
                }

                byIngredient.set(key, existing)
              }
            }
          }

          return Array.from(byIngredient.entries()).map(([key, value]) => {
            const options = [...value.replaceOptions]

            const hasReplace = value.replaceOptions.length > 0

            return {
              id: `ingredient:${key}`,
              title: value.title,
              required: false,
              multiSelect: false,
              type: "adjustable" as const,
              min: 0,
              max: 1,
              actionLabel: hasReplace ? "Replace" : "Select",
              options,
            }
          }).filter(group => group.options.length > 0)
        })()
      : []

  const mappedGroups = groups
    .filter(
      group => !hiddenSystemGroupIds.has(group.id)
    )
    .filter(
      group => !replacementGroups.some(value => value.id === group.id)
    )
    .map(group => {
    const required =
      (typeof group.min === "number" ? group.min : undefined) !== undefined
        ? Number(group.min) > 0
        : Boolean(group.required)

    const type = group.type

    return {
      id: group.id,
      title: group.name,
      required,
      multiSelect: type === "multi",
      type,
      min: typeof group.min === "number" ? group.min : undefined,
      max: typeof group.max === "number" ? group.max : undefined,
      actionLabel: actionLabelForGroup({
        id: group.id,
        title: group.name,
        type,
      }),
      options: group.options.map(option => ({
        id: option.id,
        name: option.label,
        priceDelta: Number(option.priceDelta ?? 0),
        sourceGroupId: group.id,
        sourceOptionId: option.id,
      })),
    }
  })

  return [...mappedGroups, ...ingredientAdjustables]
}

function projectSelectionsToSourceGroups(
  groups: ProductOptionGroup[],
  selections: ModifierSelections
): ModifierSelections {
  const next: ModifierSelections = {}

  for (const group of groups) {
    const selectedIds = selections[group.id] ?? []
    for (const selectedId of selectedIds) {
      const option = group.options.find(value => value.id === selectedId)
      if (!option?.sourceGroupId || !option.sourceOptionId) continue
      const existing = next[option.sourceGroupId] ?? []
      if (!existing.includes(option.sourceOptionId)) {
        next[option.sourceGroupId] = [...existing, option.sourceOptionId]
      }
    }
  }

  return next
}

function defaultSelectionsFromOptionGroups(
  groups: ProductOptionGroup[]
): ModifierSelections {
  const defaults: ModifierSelections = {}

  for (const group of groups) {
    if (group.type !== "adjustable") continue
    const normalOption = group.options.find(
      option => option.name.trim().toLowerCase() === "normal"
    )
    if (normalOption) {
      defaults[group.id] = [normalOption.id]
    }
  }

  return defaults
}

function calculateOptionGroupsDelta(
  groups: ProductOptionGroup[],
  selections: ModifierSelections
): number {
  let delta = 0
  for (const group of groups) {
    const selectedIds = selections[group.id] ?? []
    for (const option of group.options) {
      if (selectedIds.includes(option.id)) {
        delta += Number(option.priceDelta ?? 0)
      }
    }
  }
  return Number(delta.toFixed(2))
}

function isOptionGroupSatisfied(
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

function buildOptionGroupSummary(
  groups: ProductOptionGroup[],
  selections: ModifierSelections
): string[] {
  const lines: string[] = []
  for (const group of groups) {
    const selectedIds = selections[group.id] ?? []
    const selectedLabels = group.options
      .filter(option => selectedIds.includes(option.id))
      .map(option => option.name)
    if (selectedLabels.length > 0) {
      lines.push(`${group.title}: ${selectedLabels.join(", ")}`)
    }
  }
  return lines
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

export default function TagPage({
  params,
}: {
  params?: { tagId?: string; itemId?: string }
}) {
  const router = useRouter()
  const routeParams = useParams<{ tagId?: string; itemId?: string }>()
  const pathname = usePathname()
  const tagId =
    typeof routeParams?.tagId === 'string' && routeParams.tagId.trim().length > 0
      ? routeParams.tagId.trim()
      : typeof params?.tagId === 'string'
      ? params.tagId.trim()
      : ''
  const routeItemId =
    typeof routeParams?.itemId === 'string' && routeParams.itemId.trim().length > 0
      ? routeParams.itemId.trim()
      : typeof params?.itemId === 'string' && params.itemId.trim().length > 0
      ? params.itemId.trim()
      : null
  const resolvedRouteItemId = useMemo(() => {
    if (!routeItemId) return null
    try {
      return decodeURIComponent(routeItemId)
    } catch {
      return routeItemId
    }
  }, [routeItemId])
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
  const [restaurantId, setRestaurantId] = useState<string>('unknown')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([])
  const [debugCopyStatus, setDebugCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const cartByKeyRef = useRef<Record<string, CartItem>>({})
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingSyncEntry>>({})
  const lastRequestIdRef = useRef<string>('unknown')
  const menuViewTrackedRef = useRef(false)
  const lastCategoryTrackedRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)
  const errorRef = useRef<string | null>(null)
  const errorStickyUntilRef = useRef<number>(0)
  const errorClearTimerRef = useRef<number | null>(null)

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  useEffect(() => {
    cartByKeyRef.current = cartByKey
  }, [cartByKey])

  useEffect(() => {
    errorRef.current = error
  }, [error])

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
    const count = Object.values(cartByKeyRef.current).reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0
    )
    window.dispatchEvent(
      new CustomEvent('nfc-cart-updated', {
        detail: {
          count,
          available: Boolean(sessionId),
        },
      })
    )
  }

  useEffect(() => {
    notifyHeader()
  }, [cartByKey, sessionId])

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

  const loadCart = useCallback(async (sid: string, isInitialLoad = false) => {
    const activeClientKey = ensureClientKey()

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
          if (attempt === 0) continue
          if (isInitialLoad) {
            const errorInfo = await readApiErrorInfo(res)
            setErrorSticky(cartLoadErrorMessage(errorInfo))
          }
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
        // Clear cart/basket/session errors on successful load
        if (errorRef.current) {
          const lower = errorRef.current.toLowerCase()
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
  }, [ensureClientKey, logDebug, setErrorSticky])

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

    setLoading(true)
    if (errorRef.current && errorRef.current.toLowerCase().includes('connect')) {
      setErrorSticky(null)
    }

    // Retry session creation up to 5 times with exponential backoff (300ms, 600ms, 1.2s, 2.4s, 4.8s)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 15000)
        const startedAt = Date.now()

        let res: Response
        try {
          res = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagId }),
            signal: controller.signal,
          })
        } finally {
          window.clearTimeout(timeoutId)
        }

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
  }, [loadCart, logDebug, pathname, router, setErrorSticky, setGlobalSession])

  useEffect(() => {
    ensureClientKey()
  }, [ensureClientKey])

  useEffect(() => {
    if (!tagId) return
    void connectSession(tagId)
  }, [connectSession, tagId])

  useEffect(() => {
    void loadMenu()
    // Menu is static; only load once. If item is 86'd, customer sees it when they try to order.
    // Manual refresh available via button if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sessionId) return

    let stream: EventSource | null = null
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let lastCartFetchAt = 0
    const CART_FETCH_COOLDOWN_MS = 1000  // Max 1 cart fetch per second from SSE

    const connect = () => {
      if (stream) return

      stream = new EventSource(
        `/api/cart/stream?sessionId=${encodeURIComponent(sessionId)}`
      )

      stream.onmessage = () => {
        reconnectAttempts = 0  // Reset backoff on successful message
        
        // Throttle cart fetches triggered by SSE
        const now = Date.now()
        if (now - lastCartFetchAt >= CART_FETCH_COOLDOWN_MS) {
          lastCartFetchAt = now
          void loadCart(sessionId)
        }
      }

      stream.onerror = () => {
        stream?.close()
        stream = null

        // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
        // Keep retrying silently - SSE critical for multi-guest orders
        reconnectAttempts += 1
        const backoffMs = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 30000)

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, backoffMs)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      stream?.close()
      stream = null
    }
  }, [sessionId, loadCart])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(syncTimersRef.current)) {
        window.clearTimeout(timer)
      }
      if (errorClearTimerRef.current) {
        window.clearTimeout(errorClearTimerRef.current)
        errorClearTimerRef.current = null
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

  const openCustomizer = useCallback((item: MenuItem, navigate = false) => {
    if (!sessionId) {
      setError('Live connection required. Please reload table.')
      return
    }
    const groups = normalizeItemOptionGroups(item)
    const defaultSelections = {
      ...defaultModifierSelections(item.customization),
      ...defaultSelectionsFromOptionGroups(groups),
    }

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
    if (navigate && tagId) {
      router.push(tenantTagPath(pathname, tagId, `/menu/${item.id}`))
    }
  }, [pathname, restaurantId, router, sessionId, tagId])

  const closeCustomizer = useCallback((navigate = true) => {
    setCustomizer(null)
    setCustomizerError(null)
    if (navigate && routeItemId && tagId) {
      router.replace(tenantTagPath(pathname, tagId))
    }
  }, [pathname, routeItemId, router, tagId])

  useEffect(() => {
    if (!routeItemId || menuLoading) return

    const menuItems = menu.flatMap(section => section.items)
    const item = menuItems
      .find(value => value.id === resolvedRouteItemId || value.id === routeItemId)

    if (!item) {
      // Deep link is stale or malformed; return to menu instead of hanging on loader.
      setErrorSticky("We couldn't open that item. Please choose it from the menu.")
      if (tagId) {
        router.replace(tenantTagPath(pathname, tagId))
      }
      return
    }
    if (customizer?.item.id === item.id) return

    openCustomizer(item, false)
  }, [
    customizer?.item.id,
    menu,
    menuLoading,
    openCustomizer,
    pathname,
    resolvedRouteItemId,
    routeItemId,
    router,
    tagId,
  ])

  const updateCustomizerSelection = (
    groupId: string,
    optionId: string,
    selected: boolean
  ) => {
    setCustomizer(current => {
      if (!current) return current
      const optionGroups = normalizeItemOptionGroups(current.item)
      const optionGroup = optionGroups.find(group => group.id === groupId)
      if (!optionGroup) return current

      const existing = current.selections[groupId] ?? []
      let nextForGroup = [...existing]

      if (optionGroup.type === 'single' || optionGroup.type === 'adjustable') {
        nextForGroup = selected ? [optionId] : []
      } else if (selected) {
        nextForGroup = [...new Set([...existing, optionId])]
      } else {
        nextForGroup = existing.filter(value => value !== optionId)
      }

      const nextSelections = {
        ...current.selections,
        [groupId]: nextForGroup,
      }

      return {
        ...current,
        selections: nextSelections,
      }
    })
  }

  const applyCustomizedItem = () => {
    if (!customizer) return
    if (menuLocked) {
      setCustomizerError('Ordering is temporarily paused by staff.')
      return
    }
    if (!sessionId) {
      setError('Live connection required. Please reload table.')
      return
    }

    const item = customizer.item
    const customization = item.customization
    const optionGroups = normalizeItemOptionGroups(item)
    const projectedSelections = projectSelectionsToSourceGroups(
      optionGroups,
      customizer.selections
    )

    const requiredRemainingLocal = optionGroups.reduce((count, group) => {
      const selectedIds = customizer.selections[group.id] ?? []
      return isOptionGroupSatisfied(group, selectedIds) ? count : count + 1
    }, 0)

    if (requiredRemainingLocal > 0) {
      setCustomizerError(
        `Select required options in ${requiredRemainingLocal} ${
          requiredRemainingLocal === 1 ? 'group' : 'groups'
        } before adding.`
      )
      return
    }

    const validation = validateModifierSelections(
      customization,
      projectedSelections
    )
    if (hasCustomization(customization) && !validation.ok) {
      setCustomizerError(validation.error ?? 'Invalid selection')
      return
    }

    const normalized = hasCustomization(customization)
      ? validation.normalized
      : projectedSelections
    const modifierSummary = hasCustomization(customization)
      ? buildModifierSummary(customization, normalized)
      : buildOptionGroupSummary(optionGroups, normalized)
    const modifierDelta = hasCustomization(customization)
      ? calculateModifierDelta(customization, normalized)
      : calculateOptionGroupsDelta(optionGroups, normalized)
    const lineAllergens = hasCustomization(customization)
      ? collectModifierAllergens(
          customization,
          normalized,
          item.allergens ?? []
        )
      : item.allergens ?? []
    const unitPrice = Number((item.basePrice + modifierDelta).toFixed(2))
    const lineSignature = buildModifierSignature(normalized) || 'base'
    const lineKey = `${item.id}::${lineSignature}`

    const existing = cartByKeyRef.current[lineKey]
    const nextQty = Number(existing?.quantity ?? 0) + customizer.quantity
    const edits = optionGroups.length > 0
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
    const optionGroups = normalizeItemOptionGroups(customizer.item)
    const projectedSelections = projectSelectionsToSourceGroups(
      optionGroups,
      customizer.selections
    )
    if (!hasCustomization(customizer.item.customization)) {
      return { ok: true, normalized: projectedSelections }
    }
    return validateModifierSelections(
      customizer.item.customization,
      projectedSelections
    )
  }, [customizer])

  const customizerOptionGroups = useMemo(() => {
    if (!customizer) return [] as ProductOptionGroup[]
    return normalizeItemOptionGroups(customizer.item)
  }, [customizer])

  const customizerUnitPrice = useMemo(() => {
    if (!customizer) return 0
    const customization = customizer.item.customization
    const optionGroups = customizerOptionGroups
    const projectedSelections = projectSelectionsToSourceGroups(
      optionGroups,
      customizer.selections
    )
    const normalized =
      customizerValidation?.normalized ?? projectedSelections
    const delta = hasCustomization(customization)
      ? calculateModifierDelta(customization, normalized)
      : calculateOptionGroupsDelta(customizerOptionGroups, customizer.selections)
    return Number((customizer.item.basePrice + delta).toFixed(2))
  }, [customizer, customizerOptionGroups, customizerValidation])

  const requiredRemaining = useMemo(() => {
    if (!customizer) return 0
    return customizerOptionGroups.reduce((count, group) => {
      const selectedIds = customizer.selections[group.id] ?? []
      return isOptionGroupSatisfied(group, selectedIds) ? count : count + 1
    }, 0)
  }, [customizer, customizerOptionGroups])

  const retryOrderData = () => {
    if (sessionId) {
      void loadCart(sessionId, true)
    } else if (tagId) {
      void connectSession(tagId)
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

  if (routeItemId && !customizer) {
    return (
      <div className="order-page">
        <div className="menu-lock-banner">Loading product…</div>
      </div>
    )
  }

  if (customizer) {
    return (
      <div className="order-page">
        <ProductDetail
          item={customizer.item}
          quantity={customizer.quantity}
          groups={customizerOptionGroups}
          selections={customizer.selections}
          requiredRemaining={requiredRemaining}
          customizerError={customizerError}
          totalPrice={customizerUnitPrice * customizer.quantity}
          onClose={() => closeCustomizer(true)}
          onToggleOption={updateCustomizerSelection}
          onQuantityChange={nextQty =>
            setCustomizer(current =>
              current
                ? {
                    ...current,
                    quantity: nextQty,
                  }
                : current
            )
          }
          onAddToBasket={applyCustomizedItem}
          addDisabled={
            menuLocked ||
            Boolean(customizerValidation && !customizerValidation.ok) ||
            requiredRemaining > 0
          }
        />
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
                onClick={() => openCustomizer(item, false)}
              />
            )
          })}
        </MenuSection>
      )}

      {!activeSection && (
        <div className="menu-empty-state">Menu unavailable</div>
      )}

    </div>
  )
}
