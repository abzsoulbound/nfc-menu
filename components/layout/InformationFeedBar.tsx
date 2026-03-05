"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { resolveInformationFeed } from "@/lib/informationFeed"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { useRestaurantStore } from "@/store/useRestaurantStore"

function isTenantActionPath(path: string) {
  return (
    path.startsWith("/menu") ||
    path.startsWith("/order") ||
    path.startsWith("/guest-tools") ||
    path.startsWith("/pay/") ||
    path.startsWith("/staff") ||
    path.startsWith("/kitchen") ||
    path.startsWith("/bar") ||
    path.startsWith("/manager") ||
    path.startsWith("/admin") ||
    path.startsWith("/demo")
  )
}

export function InformationFeedBar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const restaurantSlug = useRestaurantStore(s => s.slug)
  const restaurantName = useRestaurantStore(s => s.name)
  const ux = useRestaurantStore(s => s.experienceConfig.ux)

  const feed = useMemo(
    () =>
      resolveInformationFeed({
        pathname,
        restaurantName,
        ux,
      }),
    [pathname, restaurantName, ux]
  )

  const actions = useMemo(
    () =>
      feed.actions.slice(0, 3).map(action => ({
        ...action,
        href:
          action.tenantAware === false || !isTenantActionPath(action.nextPath)
            ? action.nextPath
            : restaurantEntryPathForSlug(restaurantSlug, action.nextPath),
      })),
    [feed.actions, restaurantSlug]
  )

  return (
    <section className="border-b border-[var(--border)] surface-secondary">
      <div className="mx-auto w-full max-w-[var(--shell-max-width)] px-4 py-3 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Live Information Feed | {feed.context}
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] md:text-base">
              {feed.title}
            </h2>
            <p className="mt-1 text-xs text-secondary md:text-sm">
              {feed.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(value => !value)}
            className="focus-ring rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]"
          >
            {collapsed ? "Show details" : "Hide details"}
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] surface-accent p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Do This Now
              </div>
              <div className="mt-1 text-sm text-[var(--text-primary)]">
                {feed.now}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] surface-accent p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Next Step
              </div>
              <div className="mt-1 text-sm text-[var(--text-primary)]">
                {feed.next}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] surface-accent p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Verify
              </div>
              <div className="mt-1 space-y-1">
                {feed.checks.map(check => (
                  <div
                    key={check}
                    className="text-xs leading-5 text-secondary"
                  >
                    • {check}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map(action => (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
