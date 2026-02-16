"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
  const [cartOpen, setCartOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [branding, setBranding] = useState({
    name: "Marlo's Brasserie",
    logoUrl: "/images/marlos-wordmark-alpha.svg",
    primaryColor: "#12649a",
    secondaryColor: "#d5e4ee",
  })

  const routeContext = useMemo(() => {
    const orderDefaultMatch = pathname.match(/^\/order(\/.*)?$/)

    const normalizedPath = orderDefaultMatch
      ? orderDefaultMatch[1] || "/"
      : pathname

    const tagMatch = normalizedPath.match(/^\/t\/([^/]+)/)
    const tagId = tagMatch?.[1] ? safeDecode(tagMatch[1]) : null
    const basePrefix = "/order"
    const isOrderPath = pathname.startsWith("/order") || pathname.startsWith("/t/")

    return {
      tagId,
      isOrderingRoute:
        isOrderPath &&
        (normalizedPath === "/" ||
          normalizedPath === "/menu" ||
          normalizedPath.startsWith("/t/")),
      homeHref:
        tagId
        ? `${basePrefix}/t/${encodeURIComponent(tagId)}`
        : `${basePrefix}/menu`,
      cartHref:
        tagId
        ? `${basePrefix}/t/${encodeURIComponent(tagId)}/review`
        : `${basePrefix}/menu`,
    }
  }, [pathname])

  useEffect(() => {
    let active = true

    async function loadBranding() {
      try {
        const res = await fetch("/api/restaurant/current", {
          cache: "no-store",
        })
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
  }, [pathname])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.style.setProperty(
      "--accent-action",
      branding.primaryColor
    )
  }, [branding.primaryColor])

  useEffect(() => {
    setCartOpen(false)
  }, [pathname])

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
  const showBadge = cartUnavailable || cartCount > 0
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

        <button
          type="button"
          className={
            cartUnavailable
              ? `${styles.cart} ${styles.cartWarning}`
              : styles.cart
          }
          aria-label={cartAriaLabel}
          aria-disabled={cartUnavailable}
          aria-expanded={cartOpen}
          onClick={event => {
            if (cartUnavailable) {
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
              return
            }
            setCartOpen(true)
          }}
        >
          <CartIcon />
          {showBadge && (
            <span
              className={
                cartUnavailable
                  ? `${styles.cartBadge} ${styles.cartBadgeWarning}`
                  : styles.cartBadge
              }
            >
              {badgeLabel}
            </span>
          )}
        </button>
      </div>

      {cartOpen && (
        <div
          className={styles.cartDrawerOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setCartOpen(false)}
        >
          <div
            className={styles.cartDrawer}
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.cartDrawerHeader}>
              <div className={styles.cartDrawerTitle}>Basket</div>
              <button
                type="button"
                className={styles.cartDrawerClose}
                onClick={() => setCartOpen(false)}
                aria-label="Close basket"
              >
                ×
              </button>
            </div>
            <div className={styles.cartDrawerBody}>
              <div className={styles.cartDrawerCount}>
                {cartUnavailable
                  ? "Basket count unavailable"
                  : `${cartCount} item${cartCount === 1 ? "" : "s"} in your basket`}
              </div>
              <Link
                href={routeContext.cartHref}
                className={styles.cartDrawerAction}
                onClick={() => setCartOpen(false)}
              >
                View basket
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
