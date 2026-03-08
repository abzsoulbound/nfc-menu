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

  const footerClass = "shell-footer"
  const supportEmail = PUBLIC_SITE_SUPPORT_EMAIL.trim()
  const supportPhone = PUBLIC_SITE_SUPPORT_PHONE.trim()
  const supportEmailHref = supportEmail.includes("@")
    ? `mailto:${supportEmail}`
    : null
  const normalizedPhone = supportPhone.replace(/[^+\d]/g, "")
  const supportPhoneHref = normalizedPhone.length > 0
    ? `tel:${normalizedPhone}`
    : null

  return (
    <footer className={footerClass}>
      <div className={`mx-auto grid w-full max-w-[var(--shell-max-width)] gap-3 px-4 py-4 text-xs text-[var(--page-text-secondary)] md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6`}>
        <div className="space-y-1">
          <Link
            href="/"
            className="focus-ring inline-flex rounded-[var(--radius-control)] font-semibold text-[var(--page-text)]"
          >
            {footerLabel}
          </Link>
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
              className="focus-ring font-medium underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--page-text)] hover:decoration-current"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 md:text-right">
          <div>
            {supportEmailHref ? (
              <a
                href={supportEmailHref}
                className="focus-ring underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--page-text)] hover:decoration-current"
              >
                {supportEmail}
              </a>
            ) : (
              supportEmail
            )}
          </div>
          <div>
            {supportPhoneHref ? (
              <a
                href={supportPhoneHref}
                className="focus-ring underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--page-text)] hover:decoration-current"
              >
                {supportPhone}
              </a>
            ) : (
              supportPhone
            )}
          </div>
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
