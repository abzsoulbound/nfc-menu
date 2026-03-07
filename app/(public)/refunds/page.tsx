import Link from "next/link"
import { Card } from "@/components/ui/Card"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
} from "@/lib/publicSite"

const subscriptionRules = [
  "Subscription charges are billed in advance for continued software access.",
  "Cancellation before renewal stops future billing on the next cycle.",
  "Paid access can remain active through the current billing period unless suspended for abuse or non-payment.",
  "Refund requests are reviewed case by case for duplicate billing, incorrect charges, or material service failure.",
] as const

const orderRefundRules = [
  "Diners pay restaurants through the restaurant's connected payment account.",
  "Food, drink, service, and venue quality refunds are handled by the restaurant first.",
  "Escalation support is available when a connected payment reference needs platform-side review.",
] as const

export default function RefundsPage() {
  return (
    <div className="relative overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(208,170,103,0.2),transparent_34%),radial-gradient(circle_at_84%_16%,rgba(104,154,232,0.24),transparent_44%),linear-gradient(180deg,#060d19_0%,#0b1a31_48%,#0e213d_100%)]"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-36 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(208,170,103,0.26),rgba(208,170,103,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[30%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(104,154,232,0.28),rgba(104,154,232,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-5">
        <section className="sales-reveal rounded-[28px] border border-[rgba(124,168,239,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(208,170,103,0.44)] bg-[rgba(208,170,103,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3c995]">
                Refunds and Cancellation
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f6eedf] md:text-6xl">
                Refund, cancellation, and fulfilment policy
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(233,223,205,0.86)] md:text-base">
                {PUBLIC_SITE_NAME} provides digital software access. There is
                no physical shipping fulfilment. Restaurant-facing billing and
                diner payment responsibility are separated clearly.
              </p>
              <div className="inline-flex rounded-full border border-[rgba(124,168,239,0.42)] bg-[rgba(39,63,101,0.46)] px-3 py-1 text-xs text-[#d8e6ff]">
                Last updated {PUBLIC_SITE_LAST_UPDATED}
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(124,168,239,0.34)] bg-[rgba(10,20,38,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                Quick Notes
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[rgba(208,225,251,0.88)]">
                <p>Digital service only: no shipping or postal returns.</p>
                <p>
                  Setup and managed onboarding become non-refundable once
                  delivery work starts.
                </p>
                <p>
                  Diner order refunds are handled by the venue as merchant of
                  record.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-1 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Subscription Charges
            </div>
            <div className="space-y-2">
              {subscriptionRules.map(rule => (
                <div
                  key={rule}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(206,222,246,0.9)]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-2 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Diner Order Refunds
            </div>
            <div className="space-y-2">
              {orderRefundRules.map(rule => (
                <div
                  key={rule}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(206,222,246,0.9)]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="sales-reveal sales-delay-3 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
            Related Policy Pages
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/pricing"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Privacy
            </Link>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(208,170,103,0.72)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-3 text-[#1a2438] transition-[filter,transform] hover:brightness-[1.05]"
            >
              Contact support
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
