"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  const sessionId = useSessionStore(s => s.sessionId)
  const [cartCount, setCartCount] = useState(0)
  const [cartUnavailable, setCartUnavailable] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [branding, setBranding] = useState({
    slug: "marlos",
    name: "Restaurant",
    logoUrl: "",
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
            slug?: string
            name?: string
            logoUrl?: string
            primaryColor?: string
            secondaryColor?: string
          }
        }
        if (!active || !payload.restaurant) return

        setBranding(current => ({
          slug: payload.restaurant?.slug || current.slug,
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
      setCartCount(0)
      setCartUnavailable(true)
      return
    }

    setCartUnavailable(false)

    const onCartUpdated: EventListener = event => {
      const detail = (
        event as CustomEvent<{
          count?: unknown
          available?: unknown
        }>
      ).detail

      const nextCount = Number(detail?.count)
      if (Number.isFinite(nextCount)) {
        setCartCount(Math.max(0, Math.trunc(nextCount)))
      }

      if (typeof detail?.available === "boolean") {
        setCartUnavailable(!detail.available)
      }
    }

    window.addEventListener("nfc-cart-updated", onCartUpdated)

    return () => {
      window.removeEventListener("nfc-cart-updated", onCartUpdated)
    }
  }, [routeContext.isOrderingRoute, routeContext.tagId, sessionId])

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
    ? "Basket is syncing. Tap to view basket status."
    : `Open cart (${cartCount} item${cartCount === 1 ? "" : "s"})`
  const isFableTenant =
    branding.slug === "fable-stores" ||
    branding.name.toLowerCase().includes("fable")

  return (
    <header
      className={scrolled ? `${styles.header} ${styles.headerScrolled}` : styles.header}
    >
      <div className={styles.inner}>
        <Link
          href={routeContext.homeHref}
          className={
            isFableTenant ? `${styles.brand} ${styles.brandFable}` : styles.brand
          }
          aria-label={branding.name}
        >
          <img
            src={
              branding.logoUrl ||
              "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            }
            alt={branding.name}
            className={styles.logo}
            loading="eager"
            decoding="async"
            onError={event => {
              event.currentTarget.src =
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
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
          onClick={() => {
            router.push(routeContext.cartHref)
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
    </header>
  )
}
