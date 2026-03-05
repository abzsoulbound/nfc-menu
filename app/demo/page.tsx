import Link from "next/link"
import nextDynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { DemoFeedQueryBootstrap } from "@/components/demo/DemoFeedQueryBootstrap"
import { DemoGuidedLaunchPanel } from "@/components/demo/DemoGuidedLaunchPanel"
import { getRestaurantForCurrentRequest } from "@/lib/restaurants"
import { restaurantEntryPathForSlug } from "@/lib/tenant"
import { isDemoToolsEnabled } from "@/lib/env"

export const metadata = {
  title: "Demo Hub",
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = "force-dynamic"

const DemoSimulatorPanel = nextDynamic(
  () =>
    import("@/components/demo/DemoSimulatorPanel").then(
      module => module.DemoSimulatorPanel
    ),
  {
    loading: () => (
      <Card variant="accent" className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">
          Live Simulator
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--border)] surface-secondary px-3 py-2"
            >
              <div className="h-3 w-20 rounded bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-5 w-10 rounded bg-[rgba(255,255,255,0.12)]" />
            </div>
          ))}
        </div>
      </Card>
    ),
  }
)

type DemoLink = {
  label: string
  nextPath: string
  detail: string
}

type DemoStep = {
  title: string
  route: string
  outcome: string
}

type CustomerWalkthroughStep = {
  title: string
  nextPath: string
  objective: string
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
    nextPath: "/menu",
    detail: "Main browsing experience with sections and items.",
  },
  {
    label: "Order (takeaway)",
    nextPath: "/order/takeaway",
    detail: "Item configurator flow and basket experience.",
  },
  {
    label: "Guest tools",
    nextPath: "/guest-tools",
    detail: "Session actions and customer utilities.",
  },
  {
    label: "Pay table",
    nextPath: "/pay/1",
    detail: "Checkout/payment screen demo.",
  },
]

const staffLoginLinks: DemoLink[] = [
  {
    label: "Waiter (login)",
    nextPath: "/staff-login?next=/staff",
    detail: "Front-of-house service and floor operations.",
  },
  {
    label: "Kitchen (login)",
    nextPath: "/staff-login?next=/kitchen",
    detail: "Kitchen ticket workflow and prep states.",
  },
  {
    label: "Bar (login)",
    nextPath: "/staff-login?next=/bar",
    detail: "Bar ticket queue and ready-state flow.",
  },
  {
    label: "Manager (login)",
    nextPath: "/staff-login?next=/manager",
    detail: "Menu controls and operational management.",
  },
  {
    label: "Admin (login)",
    nextPath: "/staff-login?next=/admin",
    detail: "System-level controls and governance.",
  },
]

const directOpsLinks: DemoLink[] = [
  {
    label: "Waiter direct",
    nextPath: "/staff",
    detail: "Use if already logged in.",
  },
  {
    label: "Kitchen direct",
    nextPath: "/kitchen",
    detail: "Use if already logged in.",
  },
  {
    label: "Bar direct",
    nextPath: "/bar",
    detail: "Use if already logged in.",
  },
  {
    label: "Manager direct",
    nextPath: "/manager",
    detail: "Use if already logged in.",
  },
  {
    label: "Admin direct",
    nextPath: "/admin",
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
    route: "/staff-login?next=/staff",
    outcome: "Demonstrate role-gated access with 4-digit code.",
  },
  {
    title: "Service-side visibility",
    route: "/staff",
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

const customerWalkthrough: CustomerWalkthroughStep[] = [
  {
    title: "Entry from table tap",
    nextPath: "/menu",
    objective:
      "Show how guests land directly in a branded menu with no app install.",
  },
  {
    title: "Build basket quickly",
    nextPath: "/order/takeaway",
    objective:
      "Demonstrate selection, edits, quantity, and low-friction add-to-order behavior.",
  },
  {
    title: "Review before commit",
    nextPath: "/order/review/demo-tag",
    objective:
      "Show transparent order review and customer confidence before submission.",
  },
  {
    title: "Need help / support path",
    nextPath: "/guest-tools",
    objective:
      "Prove guests can self-serve support requests without leaving the ordering flow.",
  },
  {
    title: "Checkout completion",
    nextPath: "/pay/1",
    objective:
      "Close the story with split/tip/payment options and clear completion outcome.",
  },
]

function LinkGrid({
  title,
  links,
  resolveHref,
}: {
  title: string
  links: DemoLink[]
  resolveHref: (nextPath: string) => string
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-2 md:grid-cols-2">
        {links.map(link => {
          const href = resolveHref(link.nextPath)
          return (
            <Link
              key={link.nextPath}
              href={href}
              className="focus-ring rounded-xl border border-[var(--border)] surface-accent px-3 py-3 transition-all duration-150 hover:-translate-y-px"
            >
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {link.label}
              </div>
              <div className="mt-1 text-xs text-secondary">{link.detail}</div>
              <div className="mt-2 text-xs text-muted mono-font">
                {href}
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

export default async function DemoPage() {
  if (!isDemoToolsEnabled()) {
    notFound()
  }

  const restaurant = await getRestaurantForCurrentRequest()
  const resolveHref = (nextPath: string) =>
    restaurantEntryPathForSlug(restaurant.slug, nextPath)

  const commandBase = `npm run demo:open -- --base-url <YOUR_BASE_URL> --tenant-slug ${restaurant.slug}`
  const commandFirstRun = `${commandBase} --profile first-run`
  const commandRushHour = `${commandBase} --profile rush-hour`
  const commandFull = `${commandBase} --profile full`
  const commandAuto = "npm run demo:auto"

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
        <DemoFeedQueryBootstrap />

        <Card variant="elevated" className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.32em] text-muted">
            Buyer Demo Hub
            {restaurant.location ? ` | ${restaurant.location}` : ""}
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
        <DemoGuidedLaunchPanel />

        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            Terminal Launch Commands
          </h2>
          <p className="text-sm text-secondary">
            Open the full demo flow in your default browser using one command.
            Replace {"<YOUR_BASE_URL>"} with your live URL.
          </p>
          <div className="space-y-2 rounded-xl border border-[var(--border)] surface-secondary p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              First customer walkthrough
            </div>
            <div className="mono-font text-xs text-[var(--text-primary)]">
              {commandFirstRun}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Rush-hour operations
            </div>
            <div className="mono-font text-xs text-[var(--text-primary)]">
              {commandRushHour}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Full all-pages launch
            </div>
            <div className="mono-font text-xs text-[var(--text-primary)]">
              {commandFull}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Zero-arg autopilot
            </div>
            <div className="mono-font text-xs text-[var(--text-primary)]">
              {commandAuto}
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">
            Customer Journey Walkthrough
          </h2>
          <div className="space-y-2">
            {customerWalkthrough.map((step, index) => {
              const href = resolveHref(step.nextPath)
              return (
                <div
                  key={step.title}
                  className="rounded-xl border border-[var(--border)] surface-accent px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="status-chip status-chip-neutral">
                        Step {index + 1}
                      </span>
                      <span className="text-sm font-semibold">{step.title}</span>
                    </div>
                    <Link
                      href={href}
                      className="focus-ring rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-1 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      Open
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-muted mono-font">
                    {href}
                  </div>
                  <div className="mt-1 text-sm text-secondary">
                    {step.objective}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

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

        <LinkGrid title="Customer Experience" links={customerLinks} resolveHref={resolveHref} />
        <LinkGrid title="Staff & Management (Login Redirects)" links={staffLoginLinks} resolveHref={resolveHref} />
        <LinkGrid title="Direct Ops Views (Already Logged In)" links={directOpsLinks} resolveHref={resolveHref} />

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
