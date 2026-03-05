import Link from "next/link"
import { SalesSimulatorShowcase } from "@/components/demo/SalesSimulatorShowcase"
import { Card } from "@/components/ui/Card"
import {
  getRestaurantForCurrentRequest,
  getRestaurantStaffAuth,
} from "@/lib/restaurants"
import { salesDemoEntryPath } from "@/lib/tenant"

export const metadata = {
  title: "Live Sales Simulator",
}

export const dynamic = "force-dynamic"

const buyerOutcomes = [
  "Guests can order in seconds without downloading an app.",
  "Service staff see live queue pressure across waiter, kitchen, and bar.",
  "Managers can control operations while preserving customer flow.",
  "Checkout path closes the loop from tap to paid table.",
] as const

const closeRunbook = [
  {
    phase: "1. Open with customer speed",
    nextPath: "/menu",
    objective:
      "Show the table-entry experience and how quickly guests can find items.",
    proof:
      "Low-friction mobile web path with category navigation and branded menu surface.",
  },
  {
    phase: "2. Build a realistic basket",
    nextPath: "/order/takeaway",
    objective:
      "Create a real order with edits, quantities, and review behavior.",
    proof:
      "Customers can configure and commit without staff intervention.",
  },
  {
    phase: "3. Show service-side visibility",
    nextPath: "/staff-login?next=/staff",
    objective:
      "Switch to role-gated waiter operations and session monitoring.",
    proof:
      "Ops team gets immediate context on active tables and order flow.",
  },
  {
    phase: "4. Turn up pressure",
    nextPath: "/staff-login?next=/kitchen",
    objective:
      "Run simulator bursts and expose queue movement in kitchen and bar.",
    proof:
      "Live prep lifecycle confirms this is an operating system, not static UI.",
  },
  {
    phase: "5. Close commercially",
    nextPath: "/pay/1",
    objective:
      "Finish on checkout and manager controls to tie operations to revenue.",
    proof:
      "One platform handles customer journey, ops workload, and payment completion.",
  },
] as const

const roleRouteLinks = [
  {
    role: "Customer menu",
    nextPath: "/menu",
    detail: "Guest browsing and item discovery.",
  },
  {
    role: "Waiter",
    nextPath: "/staff-login?next=/staff",
    detail: "Service-floor control and table visibility.",
  },
  {
    role: "Kitchen",
    nextPath: "/staff-login?next=/kitchen",
    detail: "Prep queue handling under simulated load.",
  },
  {
    role: "Bar",
    nextPath: "/staff-login?next=/bar",
    detail: "Parallel station throughput.",
  },
  {
    role: "Manager",
    nextPath: "/staff-login?next=/manager",
    detail: "Availability, controls, and oversight.",
  },
  {
    role: "Manager growth",
    nextPath: "/staff-login?next=/manager/features",
    detail: "Commercial levers and engagement controls.",
  },
] as const

const objectionHandling = [
  {
    objection: "Is this just a polished demo?",
    answer:
      "Use Full House mode and open kitchen + bar routes. Buyers see live queue transitions and throughput under load.",
  },
  {
    objection: "Can this support real operations?",
    answer:
      "Walk waiter, station, and manager views in sequence to prove shared runtime state across roles.",
  },
  {
    objection: "How does this make money?",
    answer:
      "Close on checkout plus pricing page: SaaS subscription model with Stripe Connect and billing rails already integrated.",
  },
] as const

const assetSlots = [
  {
    title: "60s founder walkthrough",
    target: "Top of /sales-demo",
    purpose:
      "Quickly frame the product before live clicking. Ideal for outbound links and first-call intros.",
  },
  {
    title: "30s guest ordering clip",
    target: "Menu to order transition",
    purpose:
      "Show frictionless tap-to-basket behavior in one short proof sequence.",
  },
  {
    title: "30s ops pressure clip",
    target: "Kitchen/bar queue section",
    purpose:
      "Demonstrate queue churn and prep lifecycle for buyer confidence.",
  },
] as const

function firstPasscode(list: string[] | undefined) {
  const first = list?.find(Boolean)
  if (!first) return "Not set"
  if (first.toLowerCase().startsWith("sha256:v1:")) {
    return "Configured"
  }
  return first
}

export default async function SalesDemoPage() {
  const salesDemoPath = salesDemoEntryPath("/sales-demo")
  const restaurant = await getRestaurantForCurrentRequest()
  const staffAuth = await getRestaurantStaffAuth(restaurant.slug)

  const passcodes = [
    {
      role: "Waiter",
      code: firstPasscode(staffAuth.WAITER),
    },
    {
      role: "Kitchen",
      code: firstPasscode(staffAuth.KITCHEN),
    },
    {
      role: "Bar",
      code: firstPasscode(staffAuth.BAR),
    },
    {
      role: "Manager",
      code: firstPasscode(staffAuth.MANAGER),
    },
    {
      role: "Admin",
      code: firstPasscode(staffAuth.ADMIN),
    },
  ]

  return (
    <div className="relative overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(212,172,103,0.18),transparent_32%),radial-gradient(circle_at_84%_14%,rgba(104,154,232,0.24),transparent_46%),linear-gradient(180deg,#050b16_0%,#09162b_48%,#0c1c35_100%)]"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-32 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(207,165,94,0.24),rgba(207,165,94,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[30%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(110,161,234,0.26),rgba(110,161,234,0))] blur-3xl [animation-delay:360ms]"
      />

      <div className="mx-auto max-w-[1240px] space-y-5">
        <section className="sales-reveal relative overflow-hidden rounded-[30px] border border-[rgba(126,170,240,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-[-60px] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(219,181,112,0.22),rgba(219,181,112,0))]"
          />

          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(207,165,94,0.44)] bg-[rgba(207,165,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e4c995]">
                Close-Ready Demo Environment
              </div>
              <h1 className="max-w-4xl font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f5eedf] md:text-6xl">
                Show the full system value in one live session.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(235,225,205,0.86)] md:text-base">
                Start here, run the simulator, and walk buyers from guest entry
                to service execution to payment completion. This page is
                structured to help you close, not just tour screens.
              </p>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={salesDemoPath}
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(207,165,94,0.74)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-4 text-sm font-semibold text-[#182238] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.05]"
                >
                  Launch demo tenant
                </Link>
                <Link
                  href={salesDemoEntryPath("/menu")}
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.56)] bg-[rgba(22,39,68,0.72)] px-4 text-sm font-semibold text-[#dbe8ff] transition-colors hover:bg-[rgba(33,56,93,0.9)]"
                >
                  Open guest menu
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.5)] bg-[rgba(17,31,55,0.74)] px-4 text-sm font-semibold text-[#dbe8ff] transition-colors hover:bg-[rgba(28,48,82,0.9)]"
                >
                  Pricing
                </Link>
                <Link
                  href="/contact"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.5)] bg-[rgba(17,31,55,0.74)] px-4 text-sm font-semibold text-[#dbe8ff] transition-colors hover:bg-[rgba(28,48,82,0.9)]"
                >
                  Book a call
                </Link>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(126,170,240,0.34)] bg-[rgba(10,20,38,0.62)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                What This Proves
              </div>
              <div className="mt-3 space-y-2">
                {buyerOutcomes.map(signal => (
                  <div
                    key={signal}
                    className="rounded-[12px] border border-[rgba(126,170,240,0.24)] bg-[rgba(22,39,66,0.62)] px-3 py-2 text-sm leading-6 text-[rgba(228,236,250,0.9)]"
                  >
                    {signal}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-1 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              5-Step Close Runbook
            </div>
            <div className="space-y-2">
              {closeRunbook.map(item => {
                const href = salesDemoEntryPath(item.nextPath)
                return (
                  <div
                    key={item.phase}
                    className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-[#edf4ff]">
                        {item.phase}
                      </div>
                      <Link
                        href={href}
                        className="rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.5)] bg-[rgba(26,44,73,0.78)] px-2 py-1 text-[11px] font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(36,60,96,0.94)]"
                      >
                        Open
                      </Link>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[rgba(200,217,243,0.86)]">
                      {item.objective}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[rgba(220,210,192,0.86)]">
                      {item.proof}
                    </p>
                    <div className="mt-1 text-xs text-[rgba(169,191,230,0.88)] mono-font">
                      {item.nextPath}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-2 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Role Access + Demo Routes
            </div>

            <div className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(218,186,125,0.92)]">
                Staff login codes
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {passcodes.map(item => (
                  <div
                    key={item.role}
                    className="rounded-[10px] border border-[rgba(126,170,240,0.24)] bg-[rgba(13,26,47,0.72)] px-2 py-2"
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[rgba(182,203,238,0.86)]">
                      {item.role}
                    </div>
                    <div className="mono-font mt-1 text-sm font-semibold text-[#eef4ff]">
                      {item.code}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {roleRouteLinks.map(item => {
                const href = salesDemoEntryPath(item.nextPath)
                return (
                  <Link
                    key={item.role}
                    href={href}
                    className="focus-ring block rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3 transition-colors hover:bg-[rgba(30,50,82,0.86)]"
                  >
                    <div className="text-sm font-semibold text-[#edf4ff]">
                      {item.role}
                    </div>
                    <div className="mt-1 text-xs text-[rgba(200,217,243,0.86)]">
                      {item.detail}
                    </div>
                    <div className="mt-1 text-xs text-[rgba(169,191,230,0.88)] mono-font">
                      {item.nextPath}
                    </div>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="sales-reveal sales-delay-3">
          <SalesSimulatorShowcase />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-4 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Proof Asset Slots
            </div>
            <p className="text-sm leading-6 text-[rgba(200,217,243,0.86)]">
              Drop your best clips/screenshots into these slots to strengthen
              outbound links and shorten first-call trust building.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {assetSlots.map(slot => (
                <div
                  key={slot.title}
                  className="rounded-[14px] border border-dashed border-[rgba(126,170,240,0.44)] bg-[linear-gradient(140deg,rgba(204,169,102,0.12),rgba(96,145,220,0.12))] px-3 py-3"
                >
                  <div className="text-sm font-semibold text-[#edf4ff]">
                    {slot.title}
                  </div>
                  <div className="mt-1 text-xs text-[rgba(217,233,255,0.88)]">
                    Target: {slot.target}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[rgba(220,210,192,0.88)]">
                    {slot.purpose}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-4 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Objection Handling
            </div>
            <div className="space-y-2">
              {objectionHandling.map(item => (
                <div
                  key={item.objection}
                  className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3"
                >
                  <div className="text-sm font-semibold text-[#edf4ff]">
                    {item.objection}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[rgba(200,217,243,0.86)]">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <section className="sales-reveal sales-delay-4 rounded-[20px] border border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.74)] px-4 py-3 text-sm leading-6 text-[rgba(214,229,251,0.84)]">
          Suggested close sequence: start at 09:00 in First Run Through,
          jump to 11:00 Rush, then run Full Day Autopilot to close at 17:00.
          Open waiter and kitchen tabs mid-run, then finish on manager and
          checkout while confidence is highest.
        </section>
      </div>
    </div>
  )
}
