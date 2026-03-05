"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  isCustomerMinimalModeEnabled,
  showCustomerDebugLabels,
} from "@/lib/customerMode"
import {
  isPublicSitePath,
  PUBLIC_SITE_LINKS,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SUPPORT_EMAIL,
  PUBLIC_SITE_SUPPORT_HOURS,
  PUBLIC_SITE_SUPPORT_PHONE,
} from "@/lib/publicSite"
import { useSessionStore } from "@/store/useSessionStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"
import { resolveUiMode } from "@/lib/ui"

export function Footer() {
  const sessionId = useSessionStore(s => s.sessionId)
  const path = usePathname()
  const publicSite = isPublicSitePath(path)
  const uiMode = resolveUiMode(path)
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const showDebugSession = showCustomerDebugLabels()
  const restaurantName = useRestaurantStore(s => s.name)
  const footerLabel = publicSite
    ? PUBLIC_SITE_NAME
    : uiMode === "staff"
      ? "Operations"
      : customerMinimalMode
        ? restaurantName
        : "Editorial warm"

  const footerClass = publicSite
    ? "border-t border-[rgba(201,169,110,0.32)] bg-[linear-gradient(110deg,#081325,#0d1d36_44%,#112849)] text-[rgba(236,226,205,0.82)]"
    : "border-t border-[var(--border)] surface-primary"

  return (
    <footer className={footerClass}>
      <div className={`mx-auto grid w-full max-w-[var(--shell-max-width)] gap-3 px-4 py-4 text-xs md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6 ${publicSite ? "text-[rgba(236,226,205,0.78)]" : "text-muted"}`}>
        <div className="space-y-1">
          <div className={`font-semibold ${publicSite ? "text-[#f4e6cb]" : "text-[var(--text-primary)]"}`}>
            {footerLabel}
          </div>
          <div>
            {publicSite
              ? "Public support, pricing, and policy pages are available below."
              : "Operational and policy links stay available across the app."}
          </div>
        </div>

        <nav className="flex flex-wrap justify-start gap-x-3 gap-y-2 md:justify-center">
          {PUBLIC_SITE_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`focus-ring font-medium underline decoration-transparent underline-offset-4 transition-colors ${publicSite ? "hover:text-[#f4dfb3] hover:decoration-[#c9a96e]" : "hover:decoration-current"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 md:text-right">
          <div>{PUBLIC_SITE_SUPPORT_EMAIL}</div>
          <div>{PUBLIC_SITE_SUPPORT_PHONE}</div>
          <div>
            {showDebugSession
              ? sessionId
                ? `Session ${sessionId.slice(0, 8)} | ${PUBLIC_SITE_SUPPORT_HOURS}`
                : `No session | ${PUBLIC_SITE_SUPPORT_HOURS}`
              : PUBLIC_SITE_SUPPORT_HOURS}
          </div>
        </div>
      </div>
    </footer>
  )
}
