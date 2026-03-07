"use client"

import Link from "next/link"
import { type ReactNode, useMemo } from "react"
import { usePathname } from "next/navigation"
import { useCartStore } from "@/store/useCartStore"

type BottomNavItem = {
  key: "menu" | "order" | "cart" | "tools"
  label: string
  href: string
  active: boolean
  icon: ReactNode
}

function resolveActiveTagId(pathname: string, scopeKey: string | null) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] === "order" && segments[1] === "review" && segments[2]) {
    return segments[2]
  }
  if (segments[0] === "order" && segments[1] && segments[1] !== "review") {
    return segments[1]
  }
  const scopeMatch = scopeKey?.match(/^customer:([^:]+):/)
  return scopeMatch?.[1] ?? null
}

function navIcon(
  d: string,
  active: boolean
) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-[var(--accent-action)]" : "text-secondary"}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const items = useCartStore(s => s.items)
  const scopeKey = useCartStore(s => s.scopeKey)
  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )
  const activeTagId = resolveActiveTagId(pathname, scopeKey)
  const cartHref = activeTagId
    ? `/order/review/${encodeURIComponent(activeTagId)}`
    : "/order/takeaway"

  const navItems: BottomNavItem[] = [
    {
      key: "menu",
      label: "Menu",
      href: "/menu",
      active: pathname === "/" || pathname.startsWith("/menu"),
      icon: navIcon("M4 5h16M4 12h16M4 19h16", pathname === "/" || pathname.startsWith("/menu")),
    },
    {
      key: "order",
      label: "Order",
      href: "/order/takeaway",
      active:
        pathname.startsWith("/order/") &&
        !pathname.startsWith("/order/review/"),
      icon: navIcon(
        "M4 6h16l-1 9H5L4 6Zm3 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
        pathname.startsWith("/order/") && !pathname.startsWith("/order/review/")
      ),
    },
    {
      key: "cart",
      label: "Cart",
      href: cartHref,
      active:
        pathname.startsWith("/order/review/") ||
        pathname.startsWith("/pay/"),
      icon: navIcon(
        "M4 6h2l2.2 9.2a1 1 0 0 0 1 .8h7.8a1 1 0 0 0 1-.8L20 9H8",
        pathname.startsWith("/order/review/") || pathname.startsWith("/pay/")
      ),
    },
    {
      key: "tools",
      label: "Tools",
      href: "/guest-tools",
      active: pathname.startsWith("/guest-tools"),
      icon: navIcon(
        "M12 3v5m0 8v5M3 12h5m8 0h5m-3.5-6.5 3.5-3.5M6.5 17.5 3 21m0-18 3.5 3.5M17.5 17.5 21 21",
        pathname.startsWith("/guest-tools")
      ),
    },
  ]

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] glass-surface px-2 py-2 md:hidden"
    >
      <ul className="mx-auto grid max-w-[680px] grid-cols-4 gap-1">
        {navItems.map(item => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`focus-ring relative flex min-h-[52px] flex-col items-center justify-center rounded-[var(--radius-control)] px-1 text-[11px] font-semibold transition-colors ${
                item.active
                  ? "bg-[rgba(229,170,20,0.18)] text-[var(--text-primary)]"
                  : "text-secondary hover:bg-[rgba(255,255,255,0.5)]"
              }`}
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
              {item.key === "cart" && cartCount > 0 ? (
                <span className="cart-bounce absolute right-2 top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent-action)] px-1 text-[10px] font-semibold text-white shadow-[0_0_8px_rgba(229,170,20,0.4)]">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
