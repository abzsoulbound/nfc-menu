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

const pitchSequence = [
  {
    step: "1. Set the room",
    detail:
      "Start in Guided mode while the owner sees calm, realistic floor activity and a clean table-to-queue flow.",
  },
  {
    step: "2. Turn pressure on",
    detail:
      "Switch to Lunch Rush or Full House to expose queue growth, prep-time movement, and live throughput metrics.",
  },
  {
    step: "3. Close commercially",
    detail:
      "Open manager and checkout tabs to prove this is a sellable operating system, not a prototype screen tour.",
  },
] as const

const buyerSignals = [
  "Queue depth updates in real time",
  "Receipts and revenue climb live during demo bursts",
  "Operations views show the same workload owners will run daily",
  "One reset recovers the full floor between demos in seconds",
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
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(207,165,94,0.44)] bg-[rgba(207,165,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e4c995]">
                Live Sales Demo
              </div>
              <h1 className="max-w-4xl font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f5eedf] md:text-6xl">
                Show owners the full system under real pressure, in real time.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(235,225,205,0.86)] md:text-base">
                This environment is built for live calls and in-person closes.
                Simulate customer load, open operations tabs, and walk a buyer
                through a complete guest-to-kitchen-to-payment cycle.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={salesDemoPath}
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(207,165,94,0.74)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-4 text-sm font-semibold text-[#182238] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.05]"
                >
                  Launch demo tenant
                </Link>
                <Link
                  href="/company"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.56)] bg-[rgba(22,39,68,0.72)] px-4 text-sm font-semibold text-[#dbe8ff] transition-colors hover:bg-[rgba(33,56,93,0.9)]"
                >
                  Company profile
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(126,170,240,0.5)] bg-[rgba(17,31,55,0.74)] px-4 text-sm font-semibold text-[#dbe8ff] transition-colors hover:bg-[rgba(28,48,82,0.9)]"
                >
                  Pricing
                </Link>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(126,170,240,0.34)] bg-[rgba(10,20,38,0.62)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                Buyer Confidence Signals
              </div>
              <div className="mt-3 space-y-2">
                {buyerSignals.map(signal => (
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-1 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Pitch Sequence
            </div>
            <div className="space-y-2">
              {pitchSequence.map(item => (
                <div
                  key={item.step}
                  className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3"
                >
                  <div className="text-sm font-semibold text-[#edf4ff]">
                    {item.step}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[rgba(200,217,243,0.86)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-2 space-y-3 border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Demo Context
            </div>
            <p className="text-sm leading-6 text-[rgba(200,217,243,0.84)]">
              Keep this screen as the control center while opening waiter,
              kitchen, bar, manager, and checkout in separate tabs.
            </p>
            <div className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(214,229,251,0.9)]">
              Need to force tenant context first? Open{" "}
              <Link
                href={salesDemoPath}
                className="font-semibold text-[#f1ddb6] underline underline-offset-4"
              >
                {salesDemoPath}
              </Link>
              .
            </div>
            <div className="rounded-[14px] border border-[rgba(126,170,240,0.28)] bg-[rgba(20,35,59,0.62)] px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                Staff Login Codes
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
          </Card>
        </div>

        <div className="sales-reveal sales-delay-3">
          <SalesSimulatorShowcase />
        </div>

        <section className="sales-reveal sales-delay-4 rounded-[20px] border border-[rgba(126,170,240,0.34)] bg-[rgba(10,21,40,0.74)] px-4 py-3 text-sm leading-6 text-[rgba(214,229,251,0.84)]">
          Tip for close-rate: run 60 seconds in Guided mode, 45 seconds in
          Lunch Rush, then open Manager and Checkout to connect operational
          proof with commercial outcome.
        </section>
      </div>
    </div>
  )
}
