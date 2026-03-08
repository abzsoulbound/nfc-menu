import Link from "next/link"
import { Card } from "@/components/ui/Card"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
  PUBLIC_SITE_SUPPORT_EMAIL,
  PUBLIC_SITE_SUPPORT_HOURS,
  PUBLIC_SITE_SUPPORT_PHONE,
} from "@/lib/publicSite"

const supportTracks = [
  {
    title: "Commercial onboarding",
    detail:
      "Venue setup, rollout planning, subscription scope, and launch scheduling.",
  },
  {
    title: "Billing and Stripe",
    detail:
      "Subscription state, Stripe Connect onboarding, and payment incidents.",
  },
  {
    title: "Live operations",
    detail:
      "Active service issues affecting waiter, kitchen, bar, or checkout flows.",
  },
] as const

const intakeChecklist = [
  "Restaurant name and location",
  "Issue track (commercial, billing, Stripe, or live ops)",
  "Urgency level and desired resolution window",
  "Table, order, or payment reference where relevant",
] as const

function toTelHref(value: string) {
  const normalized = value.replace(/[^+\d]/g, "")
  return normalized ? `tel:${normalized}` : undefined
}

function toMailtoHref(value: string) {
  return value.includes("@") ? `mailto:${value}` : undefined
}

export default function ContactPage() {
  const emailHref = toMailtoHref(PUBLIC_SITE_SUPPORT_EMAIL)
  const phoneHref = toTelHref(PUBLIC_SITE_SUPPORT_PHONE)

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
                Contact
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-white md:text-6xl">
                Direct support for onboarding, billing, and live service.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(255,255,255,0.86)] md:text-base">
                This channel is intended for restaurant owners, managers, and
                payment-provider reviewers who need fast operational responses
                with clear commercial ownership.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-[rgba(217,174,63,0.36)] bg-[rgba(217,174,63,0.12)] px-3 py-1 text-[#d9ae3f]">
                  {PUBLIC_SITE_SERVICE_AREA}
                </span>
                <span className="inline-flex rounded-full border border-[rgba(0,18,88,0.42)] bg-[rgba(0,18,88,0.46)] px-3 py-1 text-white">
                  Updated {PUBLIC_SITE_LAST_UPDATED}
                </span>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(0,18,88,0.34)] bg-[rgba(0,18,88,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.92)]">
                Direct Channels
              </div>
              <div className="mt-3 space-y-2 text-sm text-[rgba(207,224,250,0.9)]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.86)]">
                    Email
                  </div>
                  {emailHref ? (
                    <a
                      href={emailHref}
                      className="focus-ring action-surface action-button action-button-sm font-semibold"
                    >
                      {PUBLIC_SITE_SUPPORT_EMAIL}
                    </a>
                  ) : (
                    <div className="font-semibold text-white">
                      {PUBLIC_SITE_SUPPORT_EMAIL}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.86)]">
                    Phone
                  </div>
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="focus-ring action-surface action-button action-button-sm font-semibold"
                    >
                      {PUBLIC_SITE_SUPPORT_PHONE}
                    </a>
                  ) : (
                    <div className="font-semibold text-white">
                      {PUBLIC_SITE_SUPPORT_PHONE}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(255,255,255,0.86)]">
                    Hours
                  </div>
                  <div className="font-semibold text-white">
                    {PUBLIC_SITE_SUPPORT_HOURS}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card gradient={false} className="sales-reveal sales-delay-1 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Support Tracks
            </div>
            <div className="space-y-2">
              {supportTracks.map(track => (
                <div
                  key={track.title}
                  className="rounded-[14px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3"
                >
                  <h2 className="text-sm font-semibold text-white">
                    {track.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[rgba(255,255,255,0.88)]">
                    {track.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card gradient={false} className="sales-reveal sales-delay-2 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Fastest Response Checklist
            </div>
            <div className="space-y-2">
              {intakeChecklist.map(item => (
                <div
                  key={item}
                  className="rounded-[14px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-2 text-sm leading-6 text-[rgba(255,255,255,0.88)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-[14px] border border-[rgba(0,18,88,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-xs text-[rgba(186,206,238,0.84)]">
              For urgent live service issues, include the active table/order
              reference and mark the request as live operations.
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card gradient={false} className="sales-reveal sales-delay-3 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Related Pages
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Link
                href="/pricing"
                className="focus-ring action-surface action-button action-button-sm"
              >
                Pricing
              </Link>
              <Link
                href="/refunds"
                className="focus-ring action-surface action-button action-button-sm"
              >
                Refunds
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
            </div>
          </Card>

          <Card gradient={false} className="sales-reveal sales-delay-4 space-y-3 border-[rgba(0,18,88,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(217,174,63,0.9)]">
              Next Step
            </div>
            <p className="text-sm leading-6 text-[rgba(255,255,255,0.88)]">
              If you are evaluating the platform commercially, run the live
              simulator first and then open a pricing call.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sales-demo"
                className="focus-ring action-surface action-button"
              >
                Open simulator
              </Link>
              <Link
                href="/pricing"
                className="focus-ring action-surface action-button"
              >
                Review pricing model
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
