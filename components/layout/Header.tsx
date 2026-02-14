"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { DEFAULT_RESTAURANT_SLUG } from "@/lib/restaurantConstants"
import { useSessionStore } from "@/store/useSessionStore"
import { readApiErrorInfo } from "@/lib/clientApiErrors"
import styles from "./Header.module.css"

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function CartIcon() {
  return (
    <svg
      className={styles.cartIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 5h2l1.4 8.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8l1.2-5.7H7.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="9.2" cy="18.1" r="1.4" />
      <circle cx="16.4" cy="18.1" r="1.4" />
    </svg>
  )
}

export function Header() {
  const pathname = usePathname() ?? "/"
  const sessionId = useSessionStore(s => s.sessionId)
  const ensureClientKey = useSessionStore(s => s.ensureClientKey)
  const [cartCount, setCartCount] = useState(0)
  const [cartUnavailable, setCartUnavailable] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchTenantSlug, setSearchTenantSlug] = useState<string | null>(null)
  const [branding, setBranding] = useState({
    name: "Marlo's Brasserie",
    logoUrl: "/images/marlos-wordmark-alpha.svg",
    primaryColor: "#12649a",
    secondaryColor: "#d5e4ee",
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = new URLSearchParams(window.location.search).get(
      "restaurantSlug"
    )
    setSearchTenantSlug(raw ? safeDecode(raw) : null)
  }, [pathname])

  const routeContext = useMemo(() => {
    const orderTenantMatch = pathname.match(/^\/order\/r\/([^/]+)(\/.*)?$/)
    const tenantMatch = pathname.match(/^\/r\/([^/]+)(\/.*)?$/)
    const orderDefaultMatch = pathname.match(/^\/order(\/.*)?$/)

    const tenantSlugFromPath = orderTenantMatch?.[1]
      ? safeDecode(orderTenantMatch[1])
      : tenantMatch?.[1]
      ? safeDecode(tenantMatch[1])
      : null
    const tenantSlug = tenantSlugFromPath || searchTenantSlug || null

    const normalizedPath = orderTenantMatch
      ? orderTenantMatch[2] || "/order"
      : orderDefaultMatch
      ? orderDefaultMatch[1] || "/"
      : tenantMatch
      ? tenantMatch[2] || "/"
      : pathname

    const tagMatch = normalizedPath.match(/^\/t\/([^/]+)/)
    const tagId = tagMatch?.[1] ? safeDecode(tagMatch[1]) : null
    const basePrefix = "/order"
    const withTenantQuery = (path: string) => {
      if (!tenantSlug) return path
      const separator = path.includes("?") ? "&" : "?"
      return `${path}${separator}restaurantSlug=${encodeURIComponent(tenantSlug)}`
    }
    const isOrderPath =
      pathname.startsWith("/order") || pathname.startsWith("/r/") || pathname.startsWith("/t/")

    return {
      tenantSlug,
      tagId,
      isOrderingRoute:
        isOrderPath &&
        (normalizedPath === "/" ||
          normalizedPath === "/menu" ||
          normalizedPath.startsWith("/t/")),
      homeHref: withTenantQuery(
        tagId
        ? `${basePrefix}/t/${encodeURIComponent(tagId)}`
        : `${basePrefix}/menu`
      ),
      cartHref: withTenantQuery(
        tagId
        ? `${basePrefix}/t/${encodeURIComponent(tagId)}/review`
        : `${basePrefix}/menu`
      ),
    }
  }, [pathname, searchTenantSlug])

  useEffect(() => {
    let active = true

    async function loadBranding() {
      try {
        const slug = routeContext.tenantSlug || DEFAULT_RESTAURANT_SLUG
        const res = await fetch(
          `/api/restaurant/current?restaurantSlug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const payload = (await res.json()) as {
          restaurant?: {
            name?: string
            logoUrl?: string
            primaryColor?: string
            secondaryColor?: string
          }
        }
        if (!active || !payload.restaurant) return

        setBranding(current => ({
          name: payload.restaurant?.name || current.name,
          logoUrl: payload.restaurant?.logoUrl || current.logoUrl,
          primaryColor: payload.restaurant?.primaryColor || current.primaryColor,
          secondaryColor:
            payload.restaurant?.secondaryColor || current.secondaryColor,
        }))
      } catch {
        // keep fallback branding
      }
    }

    void loadBranding()

    return () => {
      active = false
    }
  }, [routeContext.tenantSlug])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.style.setProperty(
      "--accent-action",
      branding.primaryColor
    )
  }, [branding.primaryColor])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 2)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!routeContext.isOrderingRoute) {
      setCartCount(0)
      setCartUnavailable(false)
      return
    }

    if (!routeContext.tagId || !sessionId) {
      setCartUnavailable(true)
      return
    }

    let cancelled = false
    const syncLiveCount = async () => {
      try {
        const res = await fetch("/api/cart/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            clientKey: ensureClientKey(),
          }),
        })
        if (!res.ok) {
          if (!cancelled) {
            setCartUnavailable(true)
          }
          return
        }
        const payload = await res.json()
        if (cancelled) return

        const items = (
          Array.isArray(payload?.items) ? payload.items : []
        ) as Array<{ quantity?: unknown; isMine?: boolean }>
        const ownItems = items.filter(item => item.isMine !== false)
        const count = ownItems.reduce(
          (sum: number, item: { quantity?: unknown }) => {
            const quantity = Number(item?.quantity ?? 0)
            return Number.isFinite(quantity) && quantity > 0
              ? sum + quantity
              : sum
          },
          0
        )
        setCartCount(count)
        setCartUnavailable(false)
      } catch {
        if (!cancelled) {
          setCartUnavailable(true)
        }
      }
    }

    const onCartUpdated: EventListener = () => {
      void syncLiveCount()
    }

    void syncLiveCount()
    const timer = window.setInterval(() => {
      void syncLiveCount()
    }, 3000)
    window.addEventListener("nfc-cart-updated", onCartUpdated)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("nfc-cart-updated", onCartUpdated)
    }
  }, [routeContext, sessionId, ensureClientKey])

  if (!routeContext.isOrderingRoute) {
    return null
  }

  const badgeLabel = cartUnavailable
    ? "!"
    : cartCount > 99
    ? "99+"
    : String(cartCount)
  const cartAriaLabel = cartUnavailable
    ? "Basket status unavailable. Tap to retry."
    : `Open cart (${cartCount} item${cartCount === 1 ? "" : "s"})`

  return (
    <header
      className={scrolled ? `${styles.header} ${styles.headerScrolled}` : styles.header}
    >
      <div className={styles.inner}>
        <Link
          href={routeContext.homeHref}
          className={styles.brand}
          aria-label={branding.name}
        >
          <img
            src={branding.logoUrl || "/images/marlos-wordmark-alpha.svg"}
            alt={branding.name}
            className={styles.logo}
            loading="eager"
            decoding="async"
            onError={event => {
              event.currentTarget.src = "/images/marlos-wordmark-alpha-tight.png"
            }}
          />
        </Link>

        {routeContext.tagId ? (
          <Link
            href={routeContext.cartHref}
            className={
              cartUnavailable
                ? `${styles.cart} ${styles.cartWarning}`
                : styles.cart
            }
            aria-label={cartAriaLabel}
            aria-disabled={cartUnavailable}
            onClick={event => {
              if (!cartUnavailable) return
              event.preventDefault()
              if (!sessionId) return
              void (async () => {
                try {
                  const res = await fetch("/api/cart/get", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sessionId,
                      clientKey: ensureClientKey(),
                    }),
                  })
                  if (!res.ok) {
                    await readApiErrorInfo(res)
                    return
                  }
                  const payload = await res.json()
                  const items = (
                    Array.isArray(payload?.items) ? payload.items : []
                  ) as Array<{ quantity?: unknown; isMine?: boolean }>
                  const ownItems = items.filter(item => item.isMine !== false)
                  const count = ownItems.reduce(
                    (sum: number, item: { quantity?: unknown }) => {
                      const quantity = Number(item?.quantity ?? 0)
                      return Number.isFinite(quantity) && quantity > 0
                        ? sum + quantity
                        : sum
                    },
                    0
                  )
                  setCartCount(count)
                  setCartUnavailable(false)
                } catch {
                  // keep warning badge until next successful poll
                }
              })()
            }}
          >
            <CartIcon />
            <span
              className={
                cartUnavailable
                  ? `${styles.cartBadge} ${styles.cartBadgeWarning}`
                  : styles.cartBadge
              }
            >
              {badgeLabel}
            </span>
          </Link>
        ) : (
          <div className={`${styles.cart} ${styles.cartStatic}`} aria-hidden="true">
            <CartIcon />
            <span className={styles.cartBadge}>{badgeLabel}</span>
          </div>
        )}
      </div>
    </header>
  )
}
