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
    ? "bg-[rgba(255,255,255,0.08)]"
    : "bg-[rgba(255,255,255,0.72)]"
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
        <span className="absolute -right-2 -top-2 inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-[var(--accent-action)] px-1 text-xs font-semibold text-white">
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

  const headerClass = publicSite
    ? "sticky top-0 z-40 border-b border-[rgba(201,169,110,0.34)] bg-[linear-gradient(110deg,#050a14,#0d1a31_44%,#122647)] text-[#efe3cd] backdrop-blur"
    : "sticky top-0 z-40 border-b border-[var(--border)] surface-primary backdrop-blur"

  return (
    <header className={headerClass}>
      <div className="mx-auto flex w-full max-w-[var(--shell-max-width)] items-center justify-between gap-3 px-4 py-4 md:px-6 md:py-4">
        <div className={`flex items-center ${desktopOps ? "gap-4" : "gap-3"}`}>
          {publicSite ? (
            <div className="space-y-1">
              <SoulboundStudioLogo compact tone="light" />
              <div className="max-w-[540px] text-xs text-[rgba(233,219,190,0.72)]">
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
                <div className="max-w-[540px] text-xs text-muted">
                  {contextHint}
                </div>
              </div>
            </>
          )}
        </div>

        {showOrderMenuCart ? (
          <HeaderOrderCartControl />
        ) : publicSite ? (
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.44)] bg-[rgba(12,22,42,0.58)] px-3 text-xs font-semibold text-[#f2e8d3] transition-colors hover:bg-[rgba(26,41,72,0.72)]"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.66)] bg-[linear-gradient(135deg,#f0d898,#c9a96e)] px-3 text-xs font-semibold text-[#1b2135] transition-[filter,transform] hover:brightness-[1.05]"
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
