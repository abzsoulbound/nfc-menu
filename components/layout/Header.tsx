"use client"

import Link from "next/link"
import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SoulboundStudioLogo } from "@/components/public/SoulboundStudioLogo"
import { calculateCartTotals } from "@/lib/pricing"
import {
  PUBLIC_SITE_HEADER_HINT,
  isPublicSitePath,
  PUBLIC_SITE_MONOGRAM,
  PUBLIC_SITE_NAME,
} from "@/lib/publicSite"
import {
  contextLabelForPath,
  isCustomerPath,
  isOrderMenuPath,
  resolveUiMode,
} from "@/lib/ui"
import { useCartStore } from "@/store/useCartStore"
import { useOrderMenuUiStore } from "@/store/useOrderMenuUiStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"

function HeaderLogo({
  uiMode,
  desktopOps,
  logoUrl,
  monogram,
  name,
}: {
  uiMode: "customer" | "staff"
  desktopOps: boolean
  logoUrl?: string
  monogram: string
  name: string
}) {
  const usingDefaultLogo = logoUrl?.startsWith("/brand/") ?? false
  const shellClass = uiMode === "staff"
    ? "bg-[var(--logo-shell-bg)]"
    : "bg-[var(--logo-shell-bg)]"
  const sizeClass = desktopOps
    ? "h-16 w-16 md:h-20 md:w-20"
    : "h-14 w-14 md:h-16 md:w-16"

  if (logoUrl) {
    return (
      <div className={`flex ${sizeClass} items-center justify-center overflow-hidden rounded-full border border-[var(--border)] ${shellClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={`h-full w-full object-contain object-center p-[2px] ${
            usingDefaultLogo && uiMode === "staff" ? "invert" : ""
          }`}
        />
      </div>
    )
  }

  return (
    <div className={`flex ${sizeClass} items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-accent)] text-sm font-semibold tracking-[0.08em]`}>
      {monogram}
    </div>
  )
}

function resolveHeaderCartHref(pathname: string, scopeKey: string | null) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] === "order" && segments[1] === "review" && segments[2]) {
    return `/order/review/${encodeURIComponent(segments[2])}`
  }
  if (segments[0] === "order" && segments[1] && segments[1] !== "review") {
    return `/order/review/${encodeURIComponent(segments[1])}`
  }
  const scopeMatch = scopeKey?.match(/^customer:([^:]+):/)
  if (scopeMatch?.[1]) {
    return `/order/review/${encodeURIComponent(scopeMatch[1])}`
  }
  return "/order/takeaway"
}

function HeaderCartBadge() {
  const path = usePathname()
  const items = useCartStore(s => s.items)
  const scopeKey = useCartStore(s => s.scopeKey)
  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  if (totalQuantity <= 0) {
    return null
  }

  const href = resolveHeaderCartHref(path, scopeKey)

  return (
    <Link
      href={href}
      className="focus-ring relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-2 text-[var(--text-primary)] transition-opacity hover:opacity-90"
      aria-label={`Open cart, ${totalQuantity} item${totalQuantity === 1 ? "" : "s"}`}
      title="Open cart"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute -right-2 -top-2 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-action)] px-1 text-[10px] font-semibold text-black cart-bounce">
        {totalQuantity}
      </span>
    </Link>
  )
}

function HeaderOrderCartControl() {
  const pathname = usePathname()
  const router = useRouter()
  const items = useCartStore(s => s.items)
  const canOpenReview = useOrderMenuUiStore(
    s => s.canOpenReview
  )
  const openReview = useOrderMenuUiStore(s => s.openReview)
  const reviewFlow = useRestaurantStore(
    s => s.experienceConfig.ux.review
  )

  const totals = useMemo(() => {
    return calculateCartTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      }))
    )
  }, [items])

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  const hasItems = totalQuantity > 0
  const totalLabel = `£${totals.total.toFixed(2)}`
  const orderPathSegments = pathname.split("/").filter(Boolean)
  const tagId =
    orderPathSegments[0] === "order" && orderPathSegments.length >= 2
      ? orderPathSegments[1]
      : null
  const cannotResolveReviewPath =
    reviewFlow === "PAGE_REVIEW" && !tagId
  const ariaLabel = hasItems
    ? reviewFlow === "PAGE_REVIEW"
      ? `Open review page. ${totalQuantity} item${totalQuantity === 1 ? "" : "s"}, total ${totalLabel}.`
      : `Open basket. ${totalQuantity} item${totalQuantity === 1 ? "" : "s"}, total ${totalLabel}.`
    : reviewFlow === "PAGE_REVIEW"
      ? "Open review page"
      : "Open basket"

  function handleOpen() {
    if (reviewFlow === "PAGE_REVIEW" && tagId) {
      router.push(`/order/review/${tagId}`)
      return
    }
    openReview()
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={!canOpenReview || cannotResolveReviewPath}
      className="focus-ring relative inline-flex h-16 w-16 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--surface-elevated)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={ariaLabel}
      title={hasItems ? totalLabel : reviewFlow === "PAGE_REVIEW" ? "Review" : "Basket"}
    >
      <span className="relative inline-flex h-12 w-12 items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M9 16H17L21 37H45L49 24H22"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="25" cy="44" r="3" fill="currentColor" />
          <circle cx="42" cy="44" r="3" fill="currentColor" />
        </svg>
        {hasItems && (
          <span className="pointer-events-none absolute left-1/2 top-[24px] -translate-x-1/2 rounded-full bg-[var(--surface-elevated)] px-1.5 py-[1px] text-[11px] font-semibold leading-none">
            {totalLabel}
          </span>
        )}
      </span>
      {hasItems && (
        <span className="absolute -right-2 -top-2 inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-[var(--accent-action)] px-1 text-xs font-semibold text-black cart-bounce">
          {totalQuantity}
        </span>
      )}
    </button>
  )
}

export function Header() {
  const path = usePathname()
  const publicSite = isPublicSitePath(path)
  const uiMode = resolveUiMode(path)
  const context = contextLabelForPath(path)
  const showOrderMenuCart = !publicSite && isOrderMenuPath(path)
  const showHeaderCartBadge =
    !publicSite &&
    isCustomerPath(path) &&
    !path.startsWith("/order/") &&
    !path.startsWith("/pay/")
  const desktopOps = path.startsWith("/manager") || path.startsWith("/admin")
  const restaurantName = useRestaurantStore(s => s.name)
  const restaurantLocation = useRestaurantStore(s => s.location)
  const restaurantLogoUrl = useRestaurantStore(
    s => s.assets.logoUrl
  )
  const restaurantMonogram = useRestaurantStore(s => s.monogram)

  const contextHint = useMemo(() => {
    if (publicSite) return PUBLIC_SITE_HEADER_HINT
    if (uiMode === "staff") return "Operational View"
    return restaurantLocation ?? "Customer View"
  }, [publicSite, restaurantLocation, uiMode])

  const brandName = publicSite ? PUBLIC_SITE_NAME : restaurantName
  const brandMonogram = publicSite ? PUBLIC_SITE_MONOGRAM : restaurantMonogram
  const brandLogoUrl = publicSite ? undefined : restaurantLogoUrl

  const headerClass = "shell-header"

  return (
    <header className={headerClass}>
      <div className="mx-auto flex w-full max-w-[var(--shell-max-width)] items-center justify-between gap-3 px-4 py-4 md:px-6 md:py-4">
        <Link
          href="/"
          className={`focus-ring rounded-[var(--radius-control)] ${desktopOps ? "px-1 py-1" : "px-1"} flex items-center ${desktopOps ? "gap-4" : "gap-3"}`}
          aria-label="Go to company home page"
        >
          {publicSite ? (
            <div className="space-y-1">
              <SoulboundStudioLogo compact tone="light" />
              <div className="max-w-[540px] text-xs text-[var(--page-text-muted)]">
                {contextHint}
              </div>
            </div>
          ) : (
            <>
              <HeaderLogo
                uiMode={uiMode}
                desktopOps={desktopOps}
                logoUrl={brandLogoUrl}
                monogram={brandMonogram}
                name={brandName}
              />
              <div>
                <div className={`font-semibold tracking-tight ${desktopOps ? "text-lg" : ""}`}>
                  {brandName}
                </div>
                <div className="max-w-[540px] text-xs text-[var(--page-text-muted)]">
                  {contextHint}
                </div>
              </div>
            </>
          )}
        </Link>

        {showOrderMenuCart ? (
          <HeaderOrderCartControl />
        ) : showHeaderCartBadge ? (
          <HeaderCartBadge />
        ) : publicSite ? (
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-glass)] px-3 text-xs font-semibold text-[var(--page-text)] transition-colors hover:bg-[var(--surface-glass-strong)]"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="focus-ring action-surface action-button-sm"
            >
              Contact
            </Link>
          </div>
        ) : (
          <div className="status-chip status-chip-neutral">{context}</div>
        )}
      </div>
    </header>
  )
}
