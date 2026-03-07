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
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(209,171,104,0.2),transparent_34%),radial-gradient(circle_at_84%_16%,rgba(105,155,233,0.24),transparent_44%),linear-gradient(180deg,#060d19_0%,#0b1a31_48%,#0e213d_100%)]"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-36 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(209,171,104,0.26),rgba(209,171,104,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[30%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(105,155,233,0.28),rgba(105,155,233,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-5">
        <section className="sales-reveal rounded-[28px] border border-[rgba(124,168,239,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(209,171,104,0.44)] bg-[rgba(209,171,104,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3c995]">
                Privacy
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f6eedf] md:text-6xl">
                Privacy policy
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(233,223,205,0.86)] md:text-base">
                This policy describes what information is collected from
                operators and diners, why it is processed, and how payment and
                operational data are handled.
              </p>
              <div className="inline-flex rounded-full border border-[rgba(124,168,239,0.42)] bg-[rgba(39,63,101,0.46)] px-3 py-1 text-xs text-[#d8e6ff]">
                Last updated {PUBLIC_SITE_LAST_UPDATED}
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(124,168,239,0.34)] bg-[rgba(10,20,38,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
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
              className={`sales-reveal ${
                index === 0
                  ? "sales-delay-1"
                  : index === 1
                  ? "sales-delay-2"
                  : index === 2
                  ? "sales-delay-3"
                  : "sales-delay-4"
              } space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]`}
            >
              <h2 className="text-lg font-semibold tracking-tight text-[#eef4ff]">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.bullets.map(item => (
                  <div
                    key={item}
                    className="rounded-[12px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-2 text-sm leading-6 text-[rgba(206,222,246,0.9)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card className="sales-reveal sales-delay-4 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
            Related Policies
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link
              href="/terms"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Terms
            </Link>
            <Link
              href="/refunds"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Refunds
            </Link>
            <Link
              href="/pricing"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(209,171,104,0.72)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-3 text-[#1a2438] transition-[filter,transform] hover:brightness-[1.05]"
            >
              Contact support
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
