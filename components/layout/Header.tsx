"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import styles from "./Header.module.css"

const LEGACY_CART_KEY = "nfc-pos.cart.v1"
const LOCAL_CART_KEY_PREFIX = "nfc-pos.local-cart."

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseCartCount(raw: string | null): number {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as Array<{
      quantity?: unknown
    }>
    if (!Array.isArray(parsed)) return 0
    return parsed.reduce((sum, item) => {
      const quantity = Number(item?.quantity ?? 0)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return sum
      }
      return sum + quantity
    }, 0)
  } catch {
    return 0
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
  const [cartCount, setCartCount] = useState(0)

  const routeContext = useMemo(() => {
    const tagMatch = pathname.match(/^\/t\/([^/]+)/)
    const tagId = tagMatch?.[1] ? safeDecode(tagMatch[1]) : null

    return {
      tagId,
      isOrderingRoute:
        pathname === "/menu" ||
        pathname === "/order" ||
        pathname.startsWith("/t/"),
      homeHref: tagId ? `/t/${encodeURIComponent(tagId)}` : "/menu",
      cartHref: tagId ? `/t/${encodeURIComponent(tagId)}/review` : "/menu",
    }
  }, [pathname])

  useEffect(() => {
    if (!routeContext.isOrderingRoute) return

    const syncFromStorage = () => {
      const taggedCartRaw = routeContext.tagId
        ? window.localStorage.getItem(
            `${LOCAL_CART_KEY_PREFIX}${routeContext.tagId}`
          )
        : null
      const legacyCartRaw = window.localStorage.getItem(LEGACY_CART_KEY)
      const taggedCount = parseCartCount(taggedCartRaw)
      const legacyCount = parseCartCount(legacyCartRaw)
      setCartCount(routeContext.tagId ? Math.max(taggedCount, legacyCount) : legacyCount)
    }

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (
        event.key.startsWith(LOCAL_CART_KEY_PREFIX) ||
        event.key === LEGACY_CART_KEY
      ) {
        syncFromStorage()
      }
    }

    const onCartUpdated: EventListener = () => {
      syncFromStorage()
    }

    syncFromStorage()
    const timer = window.setInterval(syncFromStorage, 1500)

    window.addEventListener("storage", onStorage)
    window.addEventListener("nfc-cart-updated", onCartUpdated)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("nfc-cart-updated", onCartUpdated)
    }
  }, [routeContext])

  if (!routeContext.isOrderingRoute) {
    return null
  }

  const badgeLabel = cartCount > 99 ? "99+" : String(cartCount)
  const cartAriaLabel = `Open cart (${cartCount} item${cartCount === 1 ? "" : "s"})`

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href={routeContext.homeHref}
          className={styles.brand}
          aria-label="Marlo's Kitchen"
        >
          <img
            src="/images/marlos-wordmark-alpha.svg"
            alt="Marlo's Kitchen"
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
            className={styles.cart}
            aria-label={cartAriaLabel}
          >
            <CartIcon />
            <span className={styles.cartBadge}>{badgeLabel}</span>
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
