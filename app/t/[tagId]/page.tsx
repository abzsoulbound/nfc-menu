'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function TagPage({ params }: { params: { tagId: string } }) {
  const router = useRouter()
  const setGlobalSession = useSessionStore(s => s.setSession)
  const menuCacheKey = "nfc-pos.menu-cache.v1"
  const sessionCacheKey = `nfc-pos.tag-session.${params.tagId}`
  const localCartKey = `nfc-pos.local-cart.${params.tagId}`
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
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [clientKey, setClientKey] = useState<string | null>(null)

  const activeSection = menu.find(
    section => section.id === selectedCategoryId
  )

  const totalItems = useMemo(
    () => Object.values(cartByKey).reduce((sum, item) => sum + item.quantity, 0),
    [cartByKey]
  )

  const isLocalSessionId = (value: string | null) =>
    Boolean(value && value.startsWith("local:"))

  const createLocalSessionId = () => `local:${params.tagId}:${Date.now()}`
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
    }
  }

  const loadCart = async (sid: string) => {
    if (isLocalSessionId(sid)) {
      const local = readLocalCart()
      setCartByKey(local)
      setUsingLocalCart(true)
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
      setCartByKey(next)
      writeLocalCart(next)
      setUsingLocalCart(false)
      return true
    } catch {
      const local = readLocalCart()
      setCartByKey(local)
      setUsingLocalCart(true)
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
    const interval = setInterval(loadMenu, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const changeQty = async (item: MenuItem, delta: 1 | -1) => {
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

    const entries = Object.entries(cartByKey)
    const found =
      entries.find(([key]) => key === item.id) ??
      entries.find(([, value]) => value.menuItemId === item.id) ??
      entries.find(([, value]) => value.name === item.name)

    const existingKey = found?.[0] ?? null
    const existing = found?.[1]
    setUpdatingItemId(item.id)

    try {
      const optimistic = { ...cartByKey }

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

        optimistic[targetKey] = {
          ...base,
          name: item.name,
          menuItemId: item.id,
          unitPrice: item.basePrice,
          vatRate: item.vatRate,
          allergens: item.allergens,
          station: item.station ?? "KITCHEN",
          quantity: (base.quantity ?? 0) + 1,
        }
        if (existingKey && existingKey !== targetKey) {
          delete optimistic[existingKey]
        }
      } else if (existing && existingKey) {
        const nextQty = existing.quantity - 1
        if (nextQty <= 0) {
          delete optimistic[existingKey]
        } else {
          optimistic[existingKey] = {
            ...existing,
            quantity: nextQty,
          }
        }
      }

      setCartByKey(optimistic)
      writeLocalCart(optimistic)

      let synced = false
      if (canSync) {
        try {
          if (delta === 1) {
            if (existing && !existing.id.startsWith("local:")) {
              const response = await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: activeSessionId,
                  itemId: existing.id,
                  quantity: existing.quantity + 1,
                  clientKey: activeClientKey,
                })
              })
              synced = response.ok
            } else {
              const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: activeSessionId,
                  menuItemId: item.id,
                  name: item.name,
                  unitPrice: item.basePrice,
                  vatRate: item.vatRate,
                  allergens: item.allergens,
                  station: item.station ?? "KITCHEN",
                  quantity: 1,
                  clientKey: activeClientKey,
                })
              })
              synced = response.ok
            }
          } else if (existing && existingKey) {
            if (existing.id.startsWith("local:")) {
              synced = false
            } else if (existing.quantity <= 1) {
              const response = await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: activeSessionId,
                  itemId: existing.id,
                  quantity: 0,
                  clientKey: activeClientKey,
                })
              })
              synced = response.ok
            } else {
              const response = await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: activeSessionId,
                  itemId: existing.id,
                  quantity: existing.quantity - 1,
                  clientKey: activeClientKey,
                })
              })
              synced = response.ok
            }
          }
        } catch {
          synced = false
        }
      }

      if (synced) {
        await loadCart(activeSessionId)
      } else {
        setUsingLocalCart(true)
      }
    } finally {
      setUpdatingItemId(null)
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
        <div className="order-hero">
          <p className="menu-eyebrow">Preparing Session</p>
          <h1 className="order-title">Connecting your table</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="menu-page">
      <div className="menu-hero">
        <div className="menu-logo-wrap">
          <img
            src="/images/marlos-logo.png"
            alt="Marlo's Brasserie"
            className="menu-logo"
            loading="eager"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = "none"
              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = "block"
            }}
          />
          <div className="menu-logo-fallback">Marlo&apos;s Brasserie</div>
        </div>
      </div>

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
                editDisabled={
                  updatingItemId === item.id || menuLocked
                }
                controlsDisabled={
                  updatingItemId === item.id || menuLocked
                }
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
      </div>
    </div>
  )
}
