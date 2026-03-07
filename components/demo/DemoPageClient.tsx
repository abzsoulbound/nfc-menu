"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { DemoControlSimulator } from "@/components/demo/DemoControlSimulator"
import { DemoDisableGuidedMode } from "@/components/demo/DemoDisableGuidedMode"
import {
  DEMO_CUSTOMER_ROUTE_DEFINITIONS,
  DEMO_STAFF_ROUTE_DEFINITIONS,
  type DemoCustomerRouteKey,
  type DemoStaffRouteKey,
} from "@/lib/demoSetup"
import { useDemoSetupConfig } from "@/lib/demoSetupClient"

type DemoPageClientProps = {
  passcodes: Array<{
    role: string
    code: string
  }>
  customerRouteHrefs: Record<DemoCustomerRouteKey, string>
  staffRouteHrefs: Record<DemoStaffRouteKey, string>
}

const roleLabels: Record<string, string> = {
  W: "Waiter",
  K: "Kitchen",
  B: "Bar",
  M: "Manager",
  A: "Admin",
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(229,170,20,0.7)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[rgba(229,170,20,0.2)]" />
    </div>
  )
}

export function DemoPageClient({
  passcodes,
  customerRouteHrefs,
  staffRouteHrefs,
}: DemoPageClientProps) {
  const config = useDemoSetupConfig()

  return (
    <div className="relative overflow-hidden px-4 py-8 md:px-8 md:py-12">
      <DemoDisableGuidedMode />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_6%,rgba(0,18,88,0.9),transparent_38%),radial-gradient(circle_at_86%_12%,rgba(229,170,20,0.12),transparent_50%),linear-gradient(180deg,rgba(0,8,36,1)_0%,rgba(0,14,58,1)_45%,rgba(0,18,88,1)_100%)]"
      />

      <div className="mx-auto max-w-[1260px] space-y-6">
        <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(229,170,20,0.3)] bg-[rgba(229,170,20,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e5aa14]">
                {config.companyName}
              </span>
              <span className="rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.72)]">
                {config.companyType}
              </span>
            </div>
            <div className="space-y-2 pb-1">
              <h1 className="display-font text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {config.heroTitle}
              </h1>
              <p className="max-w-[640px] text-sm leading-relaxed text-[rgba(255,255,255,0.65)]">
                {config.heroSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              href="/demo-setup"
              className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[16px] border border-[rgba(229,170,20,0.45)] bg-[rgba(6,12,24,0.7)] px-4 text-sm font-semibold text-[#e5aa14] transition-colors hover:bg-[rgba(6,12,24,0.85)]"
            >
              Setup pitch
            </Link>
            <Link
              href={customerRouteHrefs.menu}
              className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
            >
              Open live menu
            </Link>
          </div>
        </header>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-[24px] border border-[rgba(229,170,20,0.3)] bg-[linear-gradient(160deg,rgba(0,8,36,0.96),rgba(0,18,88,0.93))] p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(229,170,20,0.72)]">
              Pitch Focus
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {config.spotlightTitle}
            </h2>
            <p className="mt-2 max-w-[720px] text-sm leading-6 text-[rgba(255,255,255,0.72)]">
              {config.spotlightBody}
            </p>
            <div className="mt-4 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.72)]">
              {config.pitchGoal}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
            {[config.priorityOne, config.priorityTwo, config.priorityThree].map(
              item => (
                <div
                  key={item}
                  className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(229,170,20,0.6)]">
                    Priority
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white">
                    {item}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>{config.passcodesSectionLabel}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
            {passcodes.map(item => (
              <div
                key={item.role}
                className="group rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3 text-center transition-all duration-200 hover:border-[rgba(229,170,20,0.4)] hover:bg-[rgba(6,12,24,0.7)]"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[rgba(229,170,20,0.7)]">
                  {roleLabels[item.role] ?? item.role}
                </div>
                <div className="mono-font mt-1.5 text-base font-semibold tabular-nums text-white">
                  {item.code}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>{config.customerSectionLabel}</SectionLabel>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {DEMO_CUSTOMER_ROUTE_DEFINITIONS.map(route => (
              <Link
                key={route.key}
                href={customerRouteHrefs[route.key]}
                className="focus-ring group flex flex-col items-center justify-center gap-1 rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-4 text-center transition-all duration-200 hover:border-[rgba(229,170,20,0.5)] hover:bg-[rgba(6,12,24,0.7)] hover:shadow-[0_2px_16px_rgba(229,170,20,0.1)]"
              >
                <span className="text-sm font-semibold tracking-wide text-[#e5aa14]">
                  {config.customerRoutes[route.key].label}
                </span>
                <span className="text-[11px] text-[rgba(255,255,255,0.5)]">
                  {config.customerRoutes[route.key].desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>{config.staffSectionLabel}</SectionLabel>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {DEMO_STAFF_ROUTE_DEFINITIONS.map(route => (
              <Link
                key={route.key}
                href={staffRouteHrefs[route.key]}
                className="focus-ring group flex flex-col items-center justify-center gap-1 rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-4 text-center transition-all duration-200 hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(6,12,24,0.7)] hover:shadow-[0_2px_16px_rgba(0,18,88,0.2)]"
              >
                <span className="text-sm font-semibold tracking-wide text-white">
                  {config.staffRoutes[route.key].label}
                </span>
                <span className="text-[11px] text-[rgba(255,255,255,0.45)]">
                  {config.staffRoutes[route.key].desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <DemoControlSimulator sectionLabel={config.simulatorSectionLabel} />
      </div>
    </div>
  )
}
