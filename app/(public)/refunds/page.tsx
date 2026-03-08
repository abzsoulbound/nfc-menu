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
        className="brand-page-backdrop pointer-events-none absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-36 -z-10 h-64 w-64 rounded-full brand-orb-gold blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[30%] -z-10 h-72 w-72 rounded-full brand-orb-navy blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-5">
        <section className="sales-reveal rounded-[28px] border border-[rgba(0,18,88,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(217,174,63,0.44)] bg-[rgba(217,174,63,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d9ae3f]">
                Refunds and Cancellation
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-white md:text-6xl">
                Refund, cancellation, and fulfilment policy
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(255,255,255,0.86)] md:text-base">
                {PUBLIC_SITE_NAME} provides digital software access. There is
                no physical shipping fulfilment. Restaurant-facing billing and
                diner payment responsibility are separated clearly.
              </p>
              <div className="inline-flex rounded-full border border-[rgba(0,18,88,0.42)] bg-[rgba(0,18,88,0.46)] px-3 py-1 text-xs text-white">
                Last updated {PUBLIC_SITE_LAST_UPDATED}
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(0,18,88,0.34)] bg-[rgba(0,18,88,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.92)]">
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
          <Card gradient={false} className="sales-reveal sales-delay-1 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Subscription Charges
            </div>
            <div className="space-y-2">
              {subscriptionRules.map(rule => (
                <div
                  key={rule}
                  className="rounded-[14px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(255,255,255,0.9)]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </Card>

          <Card gradient={false} className="sales-reveal sales-delay-2 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Diner Order Refunds
            </div>
            <div className="space-y-2">
              {orderRefundRules.map(rule => (
                <div
                  key={rule}
                  className="rounded-[14px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-sm leading-6 text-[rgba(255,255,255,0.9)]"
                >
                  {rule}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card gradient={false} className="sales-reveal sales-delay-3 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
            Related Policy Pages
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/pricing"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Privacy
            </Link>
            <Link
              href="/contact"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Contact support
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
