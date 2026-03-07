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
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(211,172,106,0.2),transparent_34%),radial-gradient(circle_at_84%_16%,rgba(108,157,233,0.24),transparent_44%),linear-gradient(180deg,#060d19_0%,#0b1a31_48%,#0e213d_100%)]"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -left-24 top-36 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(211,172,106,0.26),rgba(211,172,106,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="sales-orbit pointer-events-none absolute -right-24 top-[30%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(108,157,233,0.28),rgba(108,157,233,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-5">
        <section className="sales-reveal rounded-[28px] border border-[rgba(124,168,239,0.42)] bg-[linear-gradient(128deg,rgba(8,15,29,0.97),rgba(14,28,52,0.95),rgba(21,39,68,0.94))] px-5 py-6 shadow-[0_40px_100px_-56px_rgba(4,12,30,0.95)] md:px-8 md:py-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-[rgba(211,172,106,0.44)] bg-[rgba(211,172,106,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3c995]">
                Contact
              </div>
              <h1 className="font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f6eedf] md:text-6xl">
                Direct support for onboarding, billing, and live service.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[rgba(233,223,205,0.86)] md:text-base">
                This channel is intended for restaurant owners, managers, and
                payment-provider reviewers who need fast operational responses
                with clear commercial ownership.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-[rgba(211,172,106,0.36)] bg-[rgba(211,172,106,0.12)] px-3 py-1 text-[#e8d2ab]">
                  {PUBLIC_SITE_SERVICE_AREA}
                </span>
                <span className="inline-flex rounded-full border border-[rgba(124,168,239,0.42)] bg-[rgba(39,63,101,0.46)] px-3 py-1 text-[#d8e6ff]">
                  Updated {PUBLIC_SITE_LAST_UPDATED}
                </span>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[rgba(124,168,239,0.34)] bg-[rgba(10,20,38,0.64)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.92)]">
                Direct Channels
              </div>
              <div className="mt-3 space-y-2 text-sm text-[rgba(207,224,250,0.9)]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(171,196,236,0.86)]">
                    Email
                  </div>
                  {emailHref ? (
                    <a
                      href={emailHref}
                      className="font-semibold text-[#edf4ff] underline underline-offset-4"
                    >
                      {PUBLIC_SITE_SUPPORT_EMAIL}
                    </a>
                  ) : (
                    <div className="font-semibold text-[#edf4ff]">
                      {PUBLIC_SITE_SUPPORT_EMAIL}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(171,196,236,0.86)]">
                    Phone
                  </div>
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="font-semibold text-[#edf4ff] underline underline-offset-4"
                    >
                      {PUBLIC_SITE_SUPPORT_PHONE}
                    </a>
                  ) : (
                    <div className="font-semibold text-[#edf4ff]">
                      {PUBLIC_SITE_SUPPORT_PHONE}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[rgba(171,196,236,0.86)]">
                    Hours
                  </div>
                  <div className="font-semibold text-[#edf4ff]">
                    {PUBLIC_SITE_SUPPORT_HOURS}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-1 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Support Tracks
            </div>
            <div className="space-y-2">
              {supportTracks.map(track => (
                <div
                  key={track.title}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3"
                >
                  <h2 className="text-sm font-semibold text-[#edf4ff]">
                    {track.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[rgba(206,222,246,0.88)]">
                    {track.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-2 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Fastest Response Checklist
            </div>
            <div className="space-y-2">
              {intakeChecklist.map(item => (
                <div
                  key={item}
                  className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-2 text-sm leading-6 text-[rgba(206,222,246,0.88)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-[14px] border border-[rgba(124,168,239,0.28)] bg-[rgba(21,36,61,0.62)] px-3 py-3 text-xs text-[rgba(186,206,238,0.84)]">
              For urgent live service issues, include the active table/order
              reference and mark the request as live operations.
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="sales-reveal sales-delay-3 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Related Pages
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Link
                href="/pricing"
                className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
              >
                Pricing
              </Link>
              <Link
                href="/refunds"
                className="focus-ring inline-flex min-h-[36px] items-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.42)] bg-[rgba(31,51,84,0.76)] px-3 text-[#dce9ff] transition-colors hover:bg-[rgba(40,65,104,0.94)]"
              >
                Refunds
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
            </div>
          </Card>

          <Card className="sales-reveal sales-delay-4 space-y-3 border-[rgba(124,168,239,0.34)] bg-[rgba(10,21,40,0.76)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(218,186,125,0.9)]">
              Next Step
            </div>
            <p className="text-sm leading-6 text-[rgba(206,222,246,0.88)]">
              If you are evaluating the platform commercially, run the live
              simulator first and then open a pricing call.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sales-demo"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(124,168,239,0.52)] bg-[rgba(24,42,71,0.76)] px-4 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(33,56,93,0.9)]"
              >
                Open simulator
              </Link>
              <Link
                href="/pricing"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(211,172,106,0.72)] bg-[linear-gradient(135deg,#f2d99e,#cfa55e)] px-4 text-sm font-semibold text-[#1a2438] transition-[filter,transform] hover:brightness-[1.05]"
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
