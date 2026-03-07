import Link from "next/link"
import { Card } from "@/components/ui/Card"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
} from "@/lib/publicSite"

const commercialModel = [
  "Recurring monthly SaaS subscription per live restaurant location.",
  "Setup, migration, and managed onboarding can be quoted separately.",
  "Restaurants connect their own Stripe account so customer funds route directly to the venue.",
  "Optional transaction-based platform fee is only applied if agreed before launch.",
] as const

const includedFromDayOne = [
  "Self-serve onboarding links and manager activation flow",
  "NFC table ordering, menu, cart, review, and checkout paths",
  "Waiter, kitchen, bar, manager, and admin operational surfaces",
  "Customer page customization for menu and review experiences",
  "Stripe Connect onboarding + subscription-managed access control",
] as const

const launchPhases = [
  {
    label: "Phase 1",
    title: "Discovery",
    detail:
      "We confirm venue setup, service model, and payment requirements.",
  },
  {
    label: "Phase 2",
    title: "Go-live prep",
    detail:
      "Tenant setup, Stripe connect, menu import, and table/tag readiness checks.",
  },
  {
    label: "Phase 3",
    title: "Commercial launch",
    detail:
      "Subscription is activated after final commercial terms are accepted.",
  },
] as const

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(210,173,107,0.2),transparent_34%),radial-gradient(circle_at_84%_16%,rgba(106,156,233,0.24),transparent_44%),linear-gradient(180deg,#060d19_0%,#0b1a31_48%,#0e213d_100%)]"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-36 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(210,173,107,0.26),rgba(210,173,107,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[32%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(106,156,233,0.28),rgba(106,156,233,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-5">
        <section className="sales-reveal rounded-[28px] border border-[rgba(124,168,239,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(210,173,107,0.44)] bg-[rgba(210,173,107,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3c995]">
                Pricing
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f6eedf] md:text-6xl">
                Commercial model built for operators, not just demos.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(233,223,205,0.86)] md:text-base">
                {PUBLIC_SITE_NAME} pricing is structured for live restaurant
                operations with clear ownership of customer funds, transparent
                subscription terms, and optional platform fee configuration.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-[rgba(210,173,107,0.36)] bg-[rgba(210,173,107,0.12)] px-3 py-1 text-[#e8d2ab]">
                  {PUBLIC_SITE_SERVICE_AREA}
                </span>
                <span className="inline-flex rounded-full border border-[rgba(124,168,239,0.42)] bg-[rgba(39,63,101,0.46)] px-3 py-1 text-[#d8e6ff]">
                  Updated {PUBLIC_SITE_LAST_UPDATED}
                </span>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(124,168,239,0.34)] bg-[rgba(10,20,38,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                Commercial CTA
              </div>
              <p className="mt-3 text-sm leading-6 text-[rgba(209,226,251,0.86)]">
                Ready to scope one venue or a multi-site rollout? Open a direct
                commercial conversation and get a deployment-backed quote.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/contact"
                  className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(210,173,107,0.74)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-4 text-sm font-semibold text-[#1a2438] transition-[filter,transform] hover:brightness-[1.05]"
                >
                  Request pricing call
                </Link>
                <Link
                  href="/sales-demo"
                  className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.52)] bg-[rgba(24,42,71,0.76)] px-4 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(33,56,93,0.9)]"
                >
                  Watch live simulator
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-1 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              How We Charge
            </div>
            <div className="space-y-2">
              {commercialModel.map(item => (
                <div
                  key={item}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(206,222,246,0.9)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-2 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Billing Safeguards
            </div>
            <div className="space-y-2 text-sm leading-6 text-[rgba(206,222,246,0.88)]">
              <p>
                Subscription terms, setup scope, and any optional transaction
                fee are confirmed before activation.
              </p>
              <p>
                No hidden charges are introduced after a venue goes live.
              </p>
              <p>
                Customer payment ownership remains with the connected
                restaurant account.
              </p>
            </div>
            <div className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-xs text-[rgba(182,203,236,0.84)]">
              Legal and policy pages available:
              <div className="mt-2 flex flex-wrap gap-2 text-[rgba(214,229,251,0.94)]">
                <Link href="/refunds" className="underline underline-offset-4">
                  Refunds
                </Link>
                <Link href="/terms" className="underline underline-offset-4">
                  Terms
                </Link>
                <Link href="/privacy" className="underline underline-offset-4">
                  Privacy
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-3 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Included From Day One
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {includedFromDayOne.map(item => (
                <div
                  key={item}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(206,222,246,0.9)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-4 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Launch Phases
            </div>
            <div className="space-y-2">
              {launchPhases.map(phase => (
                <div
                  key={phase.label}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(218,186,125,0.9)]">
                    {phase.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#edf4ff]">
                    {phase.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[rgba(206,222,246,0.88)]">
                    {phase.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
