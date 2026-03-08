import { OperationsControlCenter } from "@/components/ops/OperationsControlCenter"
import Link from "next/link"
import { Card } from "@/components/ui/Card"

export default function ManagerPage() {
  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[var(--section-border)] bg-[image:var(--section-gradient)]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Manager Console
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Live operations and growth controls
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(255,255,255,0.86)]">
                Oversee service state, table interventions, queue pressure, and
                guest experience updates from one command center.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href="/manager/customize"
                className="focus-ring action-surface action-button"
              >
                Customize pages
              </Link>
              <Link
                href="/manager/features"
                className="focus-ring action-surface action-button"
              >
                Growth tools
              </Link>
            </div>
          </div>
        </Card>

        <OperationsControlCenter role="manager" />
      </div>
    </div>
  )
}
