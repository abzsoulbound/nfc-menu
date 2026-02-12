'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { useSessionStore } from "@/store/useSessionStore"
import { menu as bootstrapMenu } from "@/lib/menu-data"

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
  editable?: boolean
  editableOptions?: unknown
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

type CartItem = {
  id: string
  name: string
  quantity: number
  menuItemId?: string
  unitPrice?: number
  vatRate?: number
  allergens?: string[]
  station?: "KITCHEN" | "BAR"
}

type PendingSyncEntry = {
  sessionId: string
  clientKey: string | null
  item: MenuItem
  quantity: number
}

export default function TagPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()
  const setGlobalSession = useSessionStore(s => s.setSession)
  const menuCacheKey = "nfc-pos.menu-cache.v1"
  const sessionCacheKey = `nfc-pos.tag-session.${params.tagId}`
  const localCartKey = `nfc-pos.local-cart.${params.tagId}`
  const tableNumberCacheKey = `nfc-pos.table-number.${params.tagId}`
  const currentTableNumberKey = "nfc-pos.table-number.current"
  const clientKeyStorage = "nfc-pos.client-key.v1"
  const [menu, setMenu] = useState<MenuSectionType[]>([])
  const [menuLocked, setMenuLocked] = useState(false)
  const [menuLoading, setMenuLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    null as string | null
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cartByKey, setCartByKey] = useState<Record<string, CartItem>>({})
  const [usingLocalCart, setUsingLocalCart] = useState(false)
  const [editNotice, setEditNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientKey, setClientKey] = useState<string | null>(null)
  const cartByKeyRef = useRef<Record<string, CartItem>>({})
  const syncTimersRef = useRef<Record<string, number>>({})
  const syncInFlightRef = useRef<Record<string, boolean>>({})
  const pendingSyncRef = useRef<Record<string, PendingSyncEntry>>({})

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  const totalItems = useMemo(
    () => Object.values(cartByKey).reduce((sum, item) => sum + item.quantity, 0),
    [cartByKey]
  )

  useEffect(() => {
    cartByKeyRef.current = cartByKey
  }, [cartByKey])

  const isLocalSessionId = (value: string | null) =>
    Boolean(value && value.startsWith("local:"))

  const createLocalSessionId = () => `local:${params.tagId}:${Date.now()}`
  const notifyHeader = (
    eventName: "nfc-cart-updated" | "nfc-table-updated"
  ) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event(eventName))
  }

  const ensureClientKey = () => {
    if (typeof window === "undefined") return null

    try {
      const existing = localStorage.getItem(clientKeyStorage)
      if (existing && existing.trim().length > 0) {
        if (clientKey !== existing) {
          setClientKey(existing)
        }
        return existing
      }

      const next = crypto.randomUUID()
      localStorage.setItem(clientKeyStorage, next)
      setClientKey(next)
      return next
    } catch {
      return null
    }
  }

  const persistTableNumber = (value: unknown) => {
    const nextTableNumber = Number(value)

    try {
      if (Number.isInteger(nextTableNumber) && nextTableNumber > 0) {
        localStorage.setItem(
          tableNumberCacheKey,
          String(nextTableNumber)
        )
        localStorage.setItem(
          currentTableNumberKey,
          String(nextTableNumber)
        )
      } else {
        localStorage.removeItem(tableNumberCacheKey)
      }
    } catch {
      // best-effort cache only
    } finally {
      notifyHeader("nfc-table-updated")
    }
  }

  const readLocalCart = () => {
    try {
      const raw = localStorage.getItem(localCartKey)
      if (!raw) return {} as Record<string, CartItem>
      const parsed = JSON.parse(raw) as CartItem[]
      const items = Array.isArray(parsed) ? parsed : []
      const next: Record<string, CartItem> = {}
      for (const item of items) {
        const key = item.menuItemId ?? item.name
        next[key] = item
      }
      return next
    } catch {
      return {} as Record<string, CartItem>
    }
  }

  const writeLocalCart = (cart: Record<string, CartItem>) => {
    try {
      localStorage.setItem(
        localCartKey,
        JSON.stringify(Object.values(cart))
      )
    } catch {
      // best-effort local cache only
    } finally {
      notifyHeader("nfc-cart-updated")
    }
  }

  const sameCartLine = (localItem: CartItem, serverItem: CartItem) => {
    const localKey = localItem.menuItemId ?? localItem.name
    const serverKey = serverItem.menuItemId ?? serverItem.name

    return (
      localKey === serverKey &&
      localItem.quantity === serverItem.quantity &&
      Number(localItem.unitPrice ?? 0) === Number(serverItem.unitPrice ?? 0) &&
      Number(localItem.vatRate ?? 0) === Number(serverItem.vatRate ?? 0) &&
      (localItem.station ?? "KITCHEN") === (serverItem.station ?? "KITCHEN")
    )
  }

  const loadCart = async (sid: string) => {
    if (isLocalSessionId(sid)) {
      const local = readLocalCart()
      cartByKeyRef.current = local
      setCartByKey(local)
      setUsingLocalCart(true)
      notifyHeader("nfc-cart-updated")
      return false
    }

    try {
      const activeClientKey = ensureClientKey()
      const res = await fetch('/api/cart/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          clientKey: activeClientKey,
        })
      })

      if (!res.ok) {
        throw new Error("cart_fetch_failed")
      }

      const payload = await res.json()
      const items = (payload?.items ?? []) as (CartItem & {
        isMine?: boolean
      })[]
      const ownItems = items.filter(
        item => item.isMine !== false
      )
      const next: Record<string, CartItem> = {}
      for (const item of ownItems) {
        const key = item.menuItemId ?? item.name
        next[key] = item
      }

      const localSnapshot = readLocalCart()
      const merged = { ...next }
      let hasUnmatchedLocal = false
      const serverItems = Object.values(next)

      for (const localItem of Object.values(localSnapshot)) {
        const matchesServer = serverItems.some(serverItem =>
          sameCartLine(localItem, serverItem)
        )
        if (matchesServer) continue

        hasUnmatchedLocal = true
        const key = localItem.menuItemId ?? localItem.name
        merged[key] = localItem
      }

      const finalCart = hasUnmatchedLocal ? merged : next
      cartByKeyRef.current = finalCart
      setCartByKey(finalCart)
      writeLocalCart(finalCart)
      setUsingLocalCart(false)
      return true
    } catch {
      const local = readLocalCart()
      cartByKeyRef.current = local
      setCartByKey(local)
      setUsingLocalCart(true)
      notifyHeader("nfc-cart-updated")
      return false
    }
  }

  useEffect(() => {
    ensureClientKey()
  }, [])

  useEffect(() => {
    let mounted = true

    const readSessionCache = () => {
      try {
        return (
          localStorage.getItem(sessionCacheKey) ??
          localStorage.getItem('sessionId')
        )
      } catch {
        return null
      }
    }

    const writeSessionCache = (sid: string) => {
      try {
        localStorage.setItem(sessionCacheKey, sid)
        localStorage.setItem('sessionId', sid)
      } catch {
        // best-effort cache only
      }
    }

    const init = async () => {
      const existing = readSessionCache()

      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId: params.tagId })
        })
        if (!res.ok) {
          if (res.status === 409) {
            router.replace(`/t/${params.tagId}/closed`)
            return
          }
          throw new Error('session_bootstrap_failed')
        }

        const payload = await res.json()
        if (!mounted) return
        const sid = payload.sessionId as string
        persistTableNumber(payload?.tableNumber)
        writeSessionCache(sid)
        setSessionId(sid)
        setGlobalSession(sid, "customer")
        await loadCart(sid)
        if (mounted) setLoading(false)
      } catch {
        if (!mounted) return
        const fallbackSessionId = existing ?? createLocalSessionId()
        writeSessionCache(fallbackSessionId)
        setSessionId(fallbackSessionId)
        setGlobalSession(fallbackSessionId, "customer")
        await loadCart(fallbackSessionId)
        setUsingLocalCart(true)
        if (mounted) setLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [params.tagId, router, setGlobalSession])

  useEffect(() => {
    let cancelled = false

    const bootstrapVisibleMenu = () =>
      bootstrapMenu.map(section => ({
        id: section.id,
        name: section.name,
        items: section.items,
      }))

    const readCache = () => {
      try {
        const cached = localStorage.getItem(menuCacheKey)
        if (!cached) return null
        const parsed = JSON.parse(cached) as {
          menu?: MenuSectionType[]
          locked?: boolean
        }
        return {
          menu: Array.isArray(parsed.menu) ? parsed.menu : [],
          locked: Boolean(parsed.locked),
        }
      } catch {
        return null
      }
    }

    const writeCache = (value: {
      menu: MenuSectionType[]
      locked: boolean
    }) => {
      try {
        localStorage.setItem(
          menuCacheKey,
          JSON.stringify({
            menu: value.menu,
            locked: value.locked,
            ts: Date.now()
          })
        )
      } catch {
        // best-effort cache only
      }
    }

    async function loadMenu() {
      try {
        const res = await fetch('/api/menu', {
          cache: 'no-store'
        })
        if (!res.ok) throw new Error('menu_fetch_failed')

        const payload = await res.json()
        const incoming = Array.isArray(payload?.menu)
          ? (payload.menu as MenuSectionType[])
          : []
        const visible =
          incoming.length > 0
            ? incoming.map(section => ({
                ...section,
                items: section.items.filter(item => item.available !== false)
              }))
            : bootstrapVisibleMenu()

        if (cancelled) return

        setMenu(visible)
        setMenuLocked(Boolean(payload?.locked))
        setSelectedCategoryId(current => {
          if (current && visible.some(s => s.id === current)) {
            return current
          }
          return visible[0]?.id ?? null
        })
        writeCache({
          menu: visible,
          locked: Boolean(payload?.locked),
        })
        setMenuLoading(false)
      } catch {
        const cached = readCache()
        if (!cached) {
          const visible = bootstrapVisibleMenu()
          setMenu(visible)
          setMenuLocked(false)
          setSelectedCategoryId(current => {
            if (current && visible.some(s => s.id === current)) {
              return current
            }
            return visible[0]?.id ?? null
          })
          setMenuLoading(false)
          return
        }
        setMenu(cached.menu)
        setMenuLocked(cached.locked)
        setSelectedCategoryId(current => {
          if (current && cached.menu.some(s => s.id === current)) {
            return current
          }
          return cached.menu[0]?.id ?? null
        })
        setMenuLoading(false)
      }
    }

    loadMenu()
    const interval = setInterval(loadMenu, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(syncTimersRef.current)) {
        window.clearTimeout(timer)
      }
      syncTimersRef.current = {}
      pendingSyncRef.current = {}
      syncInFlightRef.current = {}
    }
  }, [])

  const findCartEntry = (
    source: Record<string, CartItem>,
    item: MenuItem
  ) => {
    const entries = Object.entries(source)
    const found =
      entries.find(([key]) => key === item.id) ??
      entries.find(([, value]) => value.menuItemId === item.id) ??
      entries.find(([, value]) => value.name === item.name)

    if (!found) return null
    return {
      key: found[0],
      item: found[1],
    }
  }

  const flushPendingSync = async (itemId: string) => {
    if (syncInFlightRef.current[itemId]) return

    const pending = pendingSyncRef.current[itemId]
    if (!pending) return

    syncInFlightRef.current[itemId] = true
    const requestedQty = pending.quantity

    try {
      const found = findCartEntry(cartByKeyRef.current, pending.item)
      const existing = found?.item
      let synced = false

      if (requestedQty <= 0) {
        if (!existing || existing.id.startsWith("local:")) {
          synced = true
        } else {
          const response = await fetch('/api/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: pending.sessionId,
              itemId: existing.id,
              quantity: 0,
              clientKey: pending.clientKey,
            })
          })
          synced = response.ok
        }
      } else if (existing && !existing.id.startsWith("local:")) {
        const response = await fetch('/api/cart/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: pending.sessionId,
            itemId: existing.id,
            quantity: requestedQty,
            clientKey: pending.clientKey,
          })
        })
        synced = response.ok
      } else {
        const response = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: pending.sessionId,
            menuItemId: pending.item.id,
            name: pending.item.name,
            unitPrice: pending.item.basePrice,
            vatRate: pending.item.vatRate,
            allergens: pending.item.allergens,
            station: pending.item.station ?? "KITCHEN",
            quantity: requestedQty,
            clientKey: pending.clientKey,
          })
        })
        synced = response.ok
      }

      if (synced) {
        await loadCart(pending.sessionId)
      } else {
        setUsingLocalCart(true)
      }
    } catch {
      setUsingLocalCart(true)
    } finally {
      syncInFlightRef.current[itemId] = false

      const latest = pendingSyncRef.current[itemId]
      if (!latest) return

      if (
        latest.quantity !== requestedQty ||
        latest.sessionId !== pending.sessionId
      ) {
        window.setTimeout(() => {
          void flushPendingSync(itemId)
        }, 0)
        return
      }

      delete pendingSyncRef.current[itemId]
      const timer = syncTimersRef.current[itemId]
      if (timer) {
        window.clearTimeout(timer)
        delete syncTimersRef.current[itemId]
      }
    }
  }

  const scheduleSync = (entry: PendingSyncEntry) => {
    pendingSyncRef.current[entry.item.id] = entry

    const existingTimer = syncTimersRef.current[entry.item.id]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    syncTimersRef.current[entry.item.id] = window.setTimeout(() => {
      void flushPendingSync(entry.item.id)
    }, 180)
  }

  const changeQty = (item: MenuItem, delta: 1 | -1) => {
    if (menuLocked) return

    const activeClientKey = ensureClientKey()
    let activeSessionId = sessionId
    if (!activeSessionId) {
      activeSessionId = createLocalSessionId()
      setSessionId(activeSessionId)
      setGlobalSession(activeSessionId, "customer")
      try {
        localStorage.setItem(sessionCacheKey, activeSessionId)
        localStorage.setItem("sessionId", activeSessionId)
      } catch {
        // best-effort cache only
      }
    }

    if (!activeSessionId) return
    const canSync = !isLocalSessionId(activeSessionId)
    const current = cartByKeyRef.current
    const optimistic = { ...current }
    const found = findCartEntry(current, item)
    const existingKey = found?.key ?? null
    const existing = found?.item
    let desiredQty = existing?.quantity ?? 0

    if (delta === 1) {
      const targetKey = item.id
      const base: CartItem = existing ?? {
        id: `local:${item.id}`,
        name: item.name,
        quantity: 0,
        menuItemId: item.id,
        unitPrice: item.basePrice,
        vatRate: item.vatRate,
        allergens: item.allergens,
        station: item.station ?? "KITCHEN",
      }

      desiredQty = (base.quantity ?? 0) + 1
      optimistic[targetKey] = {
        ...base,
        name: item.name,
        menuItemId: item.id,
        unitPrice: item.basePrice,
        vatRate: item.vatRate,
        allergens: item.allergens,
        station: item.station ?? "KITCHEN",
        quantity: desiredQty,
      }
      if (existingKey && existingKey !== targetKey) {
        delete optimistic[existingKey]
      }
    } else if (existing && existingKey) {
      const nextQty = existing.quantity - 1
      desiredQty = Math.max(0, nextQty)
      if (nextQty <= 0) {
        delete optimistic[existingKey]
      } else {
        optimistic[existingKey] = {
          ...existing,
          quantity: nextQty,
        }
      }
    } else {
      return
    }

    cartByKeyRef.current = optimistic
    setCartByKey(optimistic)
    writeLocalCart(optimistic)

    if (canSync) {
      scheduleSync({
        sessionId: activeSessionId,
        clientKey: activeClientKey,
        item,
        quantity: desiredQty,
      })
    } else {
      setUsingLocalCart(true)
    }
  }

  const requestItemEdit = (item: MenuItem) => {
    setEditNotice(
      `Edit options for ${item.name} are not configured yet.`
    )
  }

  useEffect(() => {
    if (!editNotice) return
    const timer = window.setTimeout(() => {
      setEditNotice(null)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [editNotice])

  if (loading || menuLoading) {
    return (
      <div className="order-page">
        <div className="menu-empty-state">Connecting your table...</div>
      </div>
    )
  }

  return (
    <div className="menu-page">
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

      {menuLocked && (
        <div className="menu-lock-banner">
          Ordering is temporarily paused by staff.
        </div>
      )}
      {usingLocalCart && !menuLocked && (
        <div className="menu-lock-banner">
          Working in local mode. Items are cached on this device.
        </div>
      )}
      {editNotice && !menuLocked && (
        <div className="menu-lock-banner">{editNotice}</div>
      )}

      {activeSection && (
        <MenuSection title={activeSection.name}>
          {activeSection.items.map(item => {
            const cartItem =
              cartByKey[item.id] ??
              Object.values(cartByKey).find(i => i.name === item.name)
            const quantity = cartItem?.quantity ?? 0

            return (
              <MenuItemCard
                key={item.id}
                name={item.name}
                description={item.description}
                image={item.image}
                price={item.basePrice}
                allergens={item.allergens}
                quantity={quantity}
                onIncrease={() => changeQty(item, 1)}
                onDecrease={() => changeQty(item, -1)}
                showEditButton={item.editable ?? true}
                onEdit={() => requestItemEdit(item)}
                editDisabled={menuLocked}
                controlsDisabled={menuLocked}
              />
            )
          })}
        </MenuSection>
      )}

      <div className="order-actions">
        <button
          className="order-cta"
          type="button"
          onClick={() => router.push(`/t/${params.tagId}/review`)}
          disabled={menuLocked || totalItems === 0}
        >
          Review Additions ({totalItems})
        </button>
        <button
          className="order-cta secondary"
          type="button"
          onClick={() => router.push(`/t/${params.tagId}/review`)}
          disabled={menuLocked}
        >
          View Table Orders
        </button>
      </div>
    </div>
  )
}
