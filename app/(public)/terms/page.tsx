import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { PUBLIC_SITE_LAST_UPDATED, PUBLIC_SITE_NAME } from "@/lib/publicSite"

const termsSections = [
  {
    title: "1. Service",
    body: `${PUBLIC_SITE_NAME} provides hosted restaurant ordering software, including menu presentation, NFC ordering, staff operations, and connected billing services.`,
  },
  {
    title: "2. Restaurant account responsibility",
    bullets: [
      "Restaurants are responsible for menu accuracy, pricing, and venue operations.",
      "Restaurants are responsible for staff access controls, passcode security, and connected payment setup.",
      "Restaurants must keep business and payout details accurate with their payment provider.",
    ],
  },
  {
    title: "3. Billing and renewal",
    bullets: [
      "Subscriptions renew on the agreed billing cycle until cancelled.",
      "Failure to pay can result in restricted access, disabled ordering, or suspension.",
      "Optional transaction fees apply only when explicitly agreed in the venue's plan.",
    ],
  },
  {
    title: "4. Connected payments",
    bullets: [
      "Customer payments are processed through the restaurant's connected payment account.",
      "The platform cannot guarantee uninterrupted third-party payment-provider availability.",
      "Chargebacks, refunds, and payment disputes are handled between the restaurant and provider.",
    ],
  },
  {
    title: "5. Acceptable use",
    bullets: [
      "No unlawful activity, fraud, abuse, or cross-tenant access attempts.",
      "No interference with service performance, security controls, or payment flows.",
      "Serious or repeated breaches can lead to immediate suspension or termination.",
    ],
  },
  {
    title: "6. Liability and changes",
    bullets: [
      "The service is provided on a commercially reasonable basis.",
      "Features, limits, pricing, or terms can be updated with notice.",
      "This starter policy should be reviewed by legal counsel before large-scale commercial rollout.",
    ],
  },
] as const

export default function TermsPage() {
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
                Terms
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-white md:text-6xl">
                Terms of service
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(255,255,255,0.86)] md:text-base">
                These terms govern access by restaurant operators and their
                staff, including billing responsibilities, payment connectivity,
                acceptable use, and platform enforcement rights.
              </p>
              <div className="inline-flex rounded-full border border-[rgba(0,18,88,0.42)] bg-[rgba(0,18,88,0.46)] px-3 py-1 text-xs text-white">
                Last updated {PUBLIC_SITE_LAST_UPDATED}
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(0,18,88,0.34)] bg-[rgba(0,18,88,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.92)]">
                Scope
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[rgba(208,225,251,0.88)]">
                <p>Applies to platform operators and staff users.</p>
                <p>
                  Intended to cover subscription, operational usage, and payment
                  integration responsibilities.
                </p>
                <p>
                  Should be counsel-reviewed before high-volume commercial scale.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4">
          {termsSections.map((section, index) => (
            <Card
              key={section.title}
              gradient={false}
              className={`sales-reveal ${
                index === 0
                  ? "sales-delay-1"
                  : index === 1
                  ? "sales-delay-2"
                  : index === 2
                  ? "sales-delay-3"
                  : "sales-delay-4"
              } space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]`}
            >
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {section.title}
              </h2>
              {"body" in section ? (
                <p className="text-sm leading-6 text-[rgba(255,255,255,0.9)]">
                  {section.body}
                </p>
              ) : (
                <div className="space-y-2">
                  {section.bullets.map(item => (
                    <div
                      key={item}
                      className="rounded-[12px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-2 text-sm leading-6 text-[rgba(255,255,255,0.9)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card gradient={false} className="sales-reveal sales-delay-4 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
            Related Policies
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/privacy"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Privacy
            </Link>
            <Link
              href="/refunds"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Refunds
            </Link>
            <Link
              href="/pricing"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Pricing
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
