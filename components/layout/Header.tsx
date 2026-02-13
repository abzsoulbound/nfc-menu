"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useSessionStore } from "@/store/useSessionStore"
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
    if (!routeContext.isOrderingRoute) {
      setCartCount(0)
      return
    }

    if (!routeContext.tagId || !sessionId) {
      setCartCount(0)
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
        if (!res.ok) return
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
      } catch {
        // keep current count on transient network errors
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
