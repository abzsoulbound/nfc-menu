import { ReactNode } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/Card"
import {
  PUBLIC_SITE_AUDIENCE,
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_LINKS,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
  PUBLIC_SITE_SUPPORT_EMAIL,
  PUBLIC_SITE_SUPPORT_HOURS,
  PUBLIC_SITE_SUPPORT_PHONE,
} from "@/lib/publicSite"

export function PublicPageFrame({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1080px] space-y-4">
        <Card
          variant="elevated"
          className="overflow-hidden border-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(237,239,234,0.94))]"
        >
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-secondary md:text-base">
              {summary}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="status-chip status-chip-neutral inline-flex">
                {PUBLIC_SITE_NAME}
              </span>
              <span className="status-chip status-chip-neutral inline-flex">
                {PUBLIC_SITE_SERVICE_AREA}
              </span>
              <span className="status-chip status-chip-neutral inline-flex">
                Updated {PUBLIC_SITE_LAST_UPDATED}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <Card className="space-y-4">{children}</Card>

          <div className="space-y-4">
            <Card variant="accent" className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Support
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    Email
                  </div>
                  <div>{PUBLIC_SITE_SUPPORT_EMAIL}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    Phone
                  </div>
                  <div>{PUBLIC_SITE_SUPPORT_PHONE}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    Hours
                  </div>
                  <div>{PUBLIC_SITE_SUPPORT_HOURS}</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    Service Area
                  </div>
                  <div>{PUBLIC_SITE_SERVICE_AREA}</div>
                </div>
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Quick Links
              </div>
              <div className="space-y-2 text-sm">
                {PUBLIC_SITE_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="focus-ring block rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 transition-colors hover:bg-[var(--surface-accent)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="space-y-2">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Who This Is For
              </div>
              <p className="text-sm leading-6 text-secondary">
                {PUBLIC_SITE_AUDIENCE}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
