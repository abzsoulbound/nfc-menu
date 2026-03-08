import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { PUBLIC_SITE_LAST_UPDATED, PUBLIC_SITE_NAME } from "@/lib/publicSite"

const privacySections = [
  {
    title: "1. Data we collect",
    bullets: [
      "Restaurant account details, contact details, subscription state, and connected billing identifiers.",
      "Operational data including tables, tags, sessions, orders, receipts, and staff actions.",
      "Optional diner data such as names, emails, phone numbers, loyalty identifiers, and payment references when supplied through checkout flows.",
    ],
  },
  {
    title: "2. Why we use it",
    bullets: [
      "To provide the ordering platform, billing support, fraud controls, and audit visibility.",
      "To process restaurant subscriptions and connected customer payments.",
      "To maintain reliability, detect abuse, and resolve incidents.",
    ],
  },
  {
    title: "3. Payment and infrastructure providers",
    bullets: [
      "Stripe is used for connected restaurant payouts and subscription billing where enabled.",
      `Hosting, database, logging, and infrastructure providers may process technical data required to operate ${PUBLIC_SITE_NAME}.`,
    ],
  },
  {
    title: "4. Retention and access",
    bullets: [
      "Operational and billing records are retained for support, accounting, and audit obligations.",
      "Restaurants should only collect personal data necessary for fulfilment and operations.",
      "Access is bounded by tenant isolation and role-based controls inside the platform.",
    ],
  },
  {
    title: "5. Rights and requests",
    bullets: [
      "Privacy and data-access requests should be sent through published support channels.",
      "Restaurants remain responsible for data rights requests related to their own diners and venue operations.",
    ],
  },
] as const

export default function PrivacyPage() {
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
                Privacy
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-white md:text-6xl">
                Privacy policy
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(255,255,255,0.86)] md:text-base">
                This policy describes what information is collected from
                operators and diners, why it is processed, and how payment and
                operational data are handled.
              </p>
              <div className="inline-flex rounded-full border border-[rgba(0,18,88,0.42)] bg-[rgba(0,18,88,0.46)] px-3 py-1 text-xs text-white">
                Last updated {PUBLIC_SITE_LAST_UPDATED}
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(0,18,88,0.34)] bg-[rgba(0,18,88,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.92)]">
                Data Position
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[rgba(208,225,251,0.88)]">
                <p>
                  Data access follows tenant boundaries and role-based security.
                </p>
                <p>
                  Payment operations rely on connected provider infrastructure,
                  including Stripe where enabled.
                </p>
                <p>
                  Requests are triaged through direct support channels.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4">
          {privacySections.map((section, index) => (
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
            </Card>
          ))}
        </div>

        <Card gradient={false} className="sales-reveal sales-delay-4 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
            Related Policies
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/terms"
              className="focus-ring action-surface action-button action-button-sm"
            >
              Terms
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
