import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { DemoSimulatorPanel } from "@/components/demo/DemoSimulatorPanel"
import { BRAND_LOCATION } from "@/lib/brand"
import {
  getDemoSimulatorStatus,
  runDemoSimulatorTick,
  startDemoSimulator,
} from "@/lib/demoSimulator"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"

export const metadata = {
  title: "Demo Hub | Fable Stores",
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = "force-dynamic"

type DemoLink = {
  label: string
  href: string
  detail: string
}

type DemoStep = {
  title: string
  route: string
  outcome: string
}

function firstPasscode(list: string | undefined) {
  return (
    list
      ?.split(",")
      .map(code => code.trim())
      .find(Boolean) ?? "Not set"
  )
}

const customerLinks: DemoLink[] = [
  {
    label: "Public menu",
    href: "/menu",
    detail: "Main browsing experience with sections and items.",
  },
  {
    label: "Order (takeaway)",
    href: "/order/takeaway",
    detail: "Item configurator flow and basket experience.",
  },
  {
    label: "Guest tools",
    href: "/guest-tools",
    detail: "Session actions and customer utilities.",
  },
  {
    label: "Pay table",
    href: "/pay/1",
    detail: "Checkout/payment screen demo.",
  },
]

const staffLoginLinks: DemoLink[] = [
  {
    label: "Waiter (login)",
    href: "/staff-login?next=/waiter",
    detail: "Front-of-house service and floor operations.",
  },
  {
    label: "Kitchen (login)",
    href: "/staff-login?next=/kitchen",
    detail: "Kitchen ticket workflow and prep states.",
  },
  {
    label: "Bar (login)",
    href: "/staff-login?next=/bar",
    detail: "Bar ticket queue and ready-state flow.",
  },
  {
    label: "Manager (login)",
    href: "/staff-login?next=/manager",
    detail: "Menu controls and operational management.",
  },
  {
    label: "Admin (login)",
    href: "/staff-login?next=/admin",
    detail: "System-level controls and governance.",
  },
]

const directOpsLinks: DemoLink[] = [
  {
    label: "Waiter direct",
    href: "/waiter",
    detail: "Use if already logged in.",
  },
  {
    label: "Kitchen direct",
    href: "/kitchen",
    detail: "Use if already logged in.",
  },
  {
    label: "Bar direct",
    href: "/bar",
    detail: "Use if already logged in.",
  },
  {
    label: "Manager direct",
    href: "/manager",
    detail: "Use if already logged in.",
  },
  {
    label: "Admin direct",
    href: "/admin",
    detail: "Use if already logged in.",
  },
]

const demoScript: DemoStep[] = [
  {
    title: "Show public browsing",
    route: "/menu",
    outcome: "Buyer sees clean menu UX, categories, and branding.",
  },
  {
    title: "Create an order",
    route: "/order/takeaway",
    outcome: "Open item configurator, pick options, add quantity, review basket.",
  },
  {
    title: "Submit and switch operations",
    route: "/staff-login?next=/waiter",
    outcome: "Demonstrate role-gated access with 4-digit code.",
  },
  {
    title: "Service-side visibility",
    route: "/waiter",
    outcome: "Show session/table monitoring and order handling.",
  },
  {
    title: "Preparation flow",
    route: "/kitchen and /bar",
    outcome: "Mark items through prep lifecycle and show live updates.",
  },
  {
    title: "Manager controls",
    route: "/manager",
    outcome: "Show availability toggles, menu import/export replacement flow.",
  },
  {
    title: "Admin controls",
    route: "/admin",
    outcome: "Show system-level controls and deployment readiness.",
  },
  {
    title: "Close with payment path",
    route: "/pay/1",
    outcome: "Show end-to-end guest completion path.",
  },
]

function LinkGrid({
  title,
  links,
}: {
  title: string
  links: DemoLink[]
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-2 md:grid-cols-2">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="focus-ring rounded-xl border border-[var(--border)] surface-accent px-3 py-3 transition-all duration-150 hover:-translate-y-px"
          >
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {link.label}
            </div>
            <div className="mt-1 text-xs text-secondary">{link.detail}</div>
            <div className="mt-2 text-xs text-muted mono-font">{link.href}</div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

export default async function DemoPage() {
  await hydrateRuntimeStateFromDb()
  const before = getDemoSimulatorStatus()
  startDemoSimulator()
  const tick = runDemoSimulatorTick()
  const shouldPersist = !before.enabled || tick.changed
  if (shouldPersist) {
    await persistRuntimeStateToDb()
    publishRuntimeEvent("demo.simulator", {
      enabled: true,
      lastTickAt: tick.status.lastTickAt,
      kitchenQueue: tick.status.queue.kitchen,
      barQueue: tick.status.queue.bar,
      readyQueue: tick.status.queue.ready,
      activeDemoSessions: tick.status.activeDemoSessions,
    })
  }

  const passcodes = [
    {
      role: "Waiter",
      code: firstPasscode(process.env.WAITER_PASSCODES),
    },
    {
      role: "Kitchen",
      code: firstPasscode(process.env.KITCHEN_PASSCODES),
    },
    {
      role: "Bar",
      code: firstPasscode(process.env.BAR_PASSCODES),
    },
    {
      role: "Manager",
      code: firstPasscode(process.env.MANAGER_PASSCODES),
    },
    {
      role: "Admin",
      code: firstPasscode(process.env.ADMIN_PASSCODES),
    },
  ]

  return (
    <div className="px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[1120px] space-y-4">
        <Card variant="elevated" className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.32em] text-muted">
            Buyer Demo Hub | {BRAND_LOCATION}
          </div>
          <h1 className="display-font text-4xl tracking-tight md:text-5xl">
            Full System Walkthrough
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-secondary">
            Use this single page to present the end-to-end product from guest menu to staff operations, manager controls, and admin oversight.
          </p>
          <p className="max-w-3xl text-sm text-secondary">
            This page auto-enables the simulator so buyers see fake sessions, fake orders, and live queue movement without manual setup.
          </p>
          <div className="status-chip status-chip-warning inline-flex">
            Rotate demo passcodes before external sharing.
          </div>
        </Card>

        <DemoSimulatorPanel />

        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            Demo Passcodes
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {passcodes.map(item => (
              <div
                key={item.role}
                className="rounded-xl border border-[var(--border)] surface-accent px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                  {item.role}
                </div>
                <div className="mono-font mt-1 text-lg font-semibold">
                  {item.code}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <LinkGrid title="Customer Experience" links={customerLinks} />
        <LinkGrid title="Staff & Management (Login Redirects)" links={staffLoginLinks} />
        <LinkGrid title="Direct Ops Views (Already Logged In)" links={directOpsLinks} />

        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            Suggested 8-Step Buyer Script
          </h2>
          <div className="space-y-2">
            {demoScript.map((step, index) => (
              <div
                key={step.title}
                className="rounded-xl border border-[var(--border)] surface-accent px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="status-chip status-chip-neutral">
                    Step {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{step.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted mono-font">
                  {step.route}
                </div>
                <div className="mt-1 text-sm text-secondary">{step.outcome}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
