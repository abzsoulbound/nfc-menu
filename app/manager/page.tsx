import { OperationsControlCenter } from "@/components/ops/OperationsControlCenter"
import Link from "next/link"
import { Card } from "@/components/ui/Card"

export default function ManagerPage() {
  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Manager Console
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Live operations and growth controls
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Oversee service state, table interventions, queue pressure, and
                guest experience updates from one command center.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href="/manager/customize"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Customize pages
              </Link>
              <Link
                href="/manager/features"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
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
