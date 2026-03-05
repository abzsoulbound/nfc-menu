import Link from "next/link"
import { SoulboundStudioLogo } from "@/components/public/SoulboundStudioLogo"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
} from "@/lib/publicSite"
import { salesDemoEntryPath } from "@/lib/tenant"

const proofSignals = [
  {
    label: "Table Tap to Menu",
    value: "1 Hop",
    detail: "NFC tag opens a live ordering surface with no app install friction.",
  },
  {
    label: "Operational Surfaces",
    value: "5 Roles",
    detail: "Waiter, kitchen, bar, manager, and admin views stay in one runtime.",
  },
  {
    label: "Sales Readiness",
    value: "Live Simulator",
    detail: "Buyer demos show queue movement, session churn, and throughput live.",
  },
  {
    label: "Commercial Rails",
    value: "Stripe Connect + Billing",
    detail: "Onboarding, subscriptions, and payment ownership are built into launch flow.",
  },
] as const

const strengthPillars = [
  {
    title: "Guest Conversion Engine",
    summary:
      "Turn a table tap into a paid checkout journey in minutes, without forcing app downloads or account friction.",
    bullets: [
      "NFC table routing with tenant-safe entry links",
      "Fast category-to-item flow, cart, review, and checkout",
      "Guest tools for loyalty, waitlist, reservation, and feedback",
    ],
    nextPath: "/menu",
    ctaLabel: "Open guest journey",
  },
  {
    title: "Real Service Operations",
    summary:
      "Show buyers what actually matters during service: queue pressure, prep flow, table status, and staff controls.",
    bullets: [
      "Live kitchen/bar queues and ready-to-delivered movement",
      "Role-gated screens for waiter, kitchen, bar, manager, and admin",
      "Simulator modes for calm walkthroughs or peak-time stress demos",
    ],
    nextPath: "/sales-demo",
    ctaLabel: "Open owner simulator",
  },
  {
    title: "Commercially Deployable",
    summary:
      "The product is structured to sell and operate as SaaS, not just as a polished frontend demo.",
    bullets: [
      "Multi-tenant restaurant isolation and onboarding setup links",
      "Stripe Connect account rails and subscription gate support",
      "Launch readiness checks, route QA, and production runbooks",
    ],
    nextPath: "/pricing",
    ctaLabel: "View pricing model",
  },
] as const

const demoJourney = [
  {
    step: "01",
    title: "Show customer entry speed",
    nextPath: "/menu",
    script:
      "Use a table link and prove guests can browse and order immediately on mobile web.",
  },
  {
    step: "02",
    title: "Place a realistic order",
    nextPath: "/order/takeaway",
    script:
      "Add items with edits, change quantity, and show order review before submit.",
  },
  {
    step: "03",
    title: "Switch to service operations",
    nextPath: "/staff-login?next=/staff",
    script:
      "Show role-based access, then demonstrate waiter visibility over tables and sessions.",
  },
  {
    step: "04",
    title: "Expose kitchen and bar load",
    nextPath: "/staff-login?next=/kitchen",
    script:
      "Open station queues and track submitted to prepping to ready movement under load.",
  },
  {
    step: "05",
    title: "Close with manager and checkout",
    nextPath: "/staff-login?next=/manager",
    script:
      "Show control levers and finish on pay-at-table to connect ops proof to revenue.",
  },
] as const

const capabilityMap = [
  {
    area: "Customer Layer",
    items: [
      "NFC deep links and tenant-aware menu entry",
      "Cart, review, checkout, and payment intent flows",
      "Loyalty, reservation, waitlist, feedback, and notifications",
    ],
  },
  {
    area: "Service Layer",
    items: [
      "Waiter dashboard for tables, sessions, and handoff",
      "Kitchen/bar station queues with prep lifecycle actions",
      "Realtime stream events for shared floor state",
    ],
  },
  {
    area: "Manager Layer",
    items: [
      "Menu controls, availability, and CSV import/export support",
      "Customizable guest-facing copy and branding surfaces",
      "Growth controls across promos, demand, and engagement features",
    ],
  },
  {
    area: "Platform Layer",
    items: [
      "Restaurant setup links and onboarding workflow",
      "Stripe Connect + subscription billing foundations",
      "Production QA scripts, route smoke checks, and launch runbooks",
    ],
  },
] as const

const techSignals = [
  "Next.js App Router",
  "TypeScript domain model",
  "PostgreSQL + Prisma",
  "Stripe + Stripe Connect",
  "Realtime SSE streams",
  "Playwright + Vitest QA",
] as const

export function CompanyPage() {
  const salesDemoPath = salesDemoEntryPath("/sales-demo")
  const demoMenuPath = salesDemoEntryPath("/menu")
  const demoCheckoutPath = salesDemoEntryPath("/pay/1")

  return (
    <div className="relative overflow-hidden px-4 py-6 md:px-6 md:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(201,169,110,0.2),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(79,118,190,0.26),transparent_42%),linear-gradient(180deg,#060c18_0%,#081427_40%,#0a1730_100%)]"
      />
      <div
        aria-hidden="true"
        className="company-orbit pointer-events-none absolute -left-24 top-28 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.3),rgba(201,169,110,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="company-orbit pointer-events-none absolute -right-28 top-64 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(99,132,197,0.32),rgba(99,132,197,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="mx-auto max-w-[1200px] space-y-6">
        <section className="company-reveal relative overflow-hidden rounded-[30px] border border-[rgba(201,169,110,0.36)] bg-[linear-gradient(126deg,rgba(4,8,18,0.96),rgba(12,23,44,0.95)_44%,rgba(19,38,69,0.93))] px-5 py-6 shadow-[0_40px_100px_-52px_rgba(4,12,30,0.96)] md:px-8 md:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_28%_32%,rgba(201,169,110,0.24),transparent_68%)]"
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-[rgba(201,169,110,0.42)] bg-[rgba(201,169,110,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ddc89e]">
                {PUBLIC_SITE_NAME}
              </div>

              <Link
                href="/"
                className="focus-ring inline-flex rounded-[var(--radius-control)]"
                aria-label="Go to company home page"
              >
                <SoulboundStudioLogo tone="light" className="items-start" />
              </Link>

              <h1 className="max-w-4xl font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f7efdf] md:text-6xl">
                The operating system for NFC-powered restaurant ordering and
                service.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-[rgba(236,226,206,0.86)] md:text-base">
                This platform is built to prove real value fast: guest
                conversion on mobile web, live service coordination across staff
                roles, and commercial rails that support real deployment.
              </p>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={salesDemoPath}
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.72)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-4 py-2 text-sm font-semibold text-[#1a2236] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.05]"
                >
                  Live owner simulator
                </Link>
                <Link
                  href={demoMenuPath}
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(136,167,230,0.44)] bg-[rgba(26,43,72,0.76)] px-4 py-2 text-sm font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(33,56,92,0.92)]"
                >
                  Open demo menu
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.44)] bg-[rgba(9,18,35,0.72)] px-4 py-2 text-sm font-semibold text-[#f2e9d6] transition-colors hover:bg-[rgba(18,34,60,0.9)]"
                >
                  Pricing model
                </Link>
                <Link
                  href="/contact"
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.44)] bg-[rgba(9,18,35,0.72)] px-4 py-2 text-sm font-semibold text-[#f2e9d6] transition-colors hover:bg-[rgba(18,34,60,0.9)]"
                >
                  Book a walkthrough
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-[rgba(201,169,110,0.34)] bg-[rgba(201,169,110,0.1)] px-3 py-1 text-[#e4ceaa]">
                  {PUBLIC_SITE_SERVICE_AREA}
                </span>
                <span className="inline-flex rounded-full border border-[rgba(149,175,225,0.34)] bg-[rgba(65,92,139,0.26)] px-3 py-1 text-[#d4e2ff]">
                  Multi-tenant SaaS architecture
                </span>
                <span className="inline-flex rounded-full border border-[rgba(227,219,202,0.2)] bg-[rgba(227,219,202,0.08)] px-3 py-1 text-[rgba(236,229,216,0.9)]">
                  Updated {PUBLIC_SITE_LAST_UPDATED}
                </span>
              </div>
            </div>

            <aside className="rounded-[22px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(165deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-4 md:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Why Buyers Engage
              </div>
              <div className="mt-3 space-y-2">
                {proofSignals.map(signal => (
                  <div
                    key={signal.label}
                    className="rounded-[12px] border border-[rgba(201,169,110,0.24)] bg-[rgba(8,14,27,0.52)] px-3 py-3"
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[rgba(222,199,151,0.86)]">
                      {signal.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#f2e8d2]">
                      {signal.value}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[rgba(221,209,186,0.82)]">
                      {signal.detail}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="company-reveal company-delay-1 rounded-[24px] border border-[rgba(201,169,110,0.3)] bg-[linear-gradient(160deg,rgba(7,13,26,0.96),rgba(11,22,41,0.93))] p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
            Product Strengths
          </div>
          <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
            Built to win on guest speed, service execution, and commercial
            structure.
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {strengthPillars.map(pillar => (
              <article
                key={pillar.title}
                className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-4"
              >
                <h3 className="font-semibold text-[#f2e8d2]">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[rgba(219,208,187,0.84)]">
                  {pillar.summary}
                </p>
                <div className="mt-3 space-y-2">
                  {pillar.bullets.map(line => (
                    <div
                      key={line}
                      className="rounded-[10px] border border-[rgba(149,175,225,0.24)] bg-[rgba(11,19,34,0.52)] px-3 py-2 text-xs leading-5 text-[rgba(222,234,255,0.9)]"
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <Link
                  href={
                    pillar.nextPath.startsWith("/")
                      ? salesDemoEntryPath(pillar.nextPath)
                      : pillar.nextPath
                  }
                  className="mt-3 inline-flex rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.48)] bg-[rgba(201,169,110,0.1)] px-3 py-2 text-xs font-semibold text-[#ecd8b4] transition-colors hover:bg-[rgba(201,169,110,0.18)]"
                >
                  {pillar.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="company-reveal company-delay-2 rounded-[24px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(158deg,rgba(8,14,28,0.97),rgba(13,25,47,0.94))] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Live Demo Journey
              </div>
              <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
                A buyer flow that proves the whole system in one session.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={salesDemoPath}
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.7)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-4 text-sm font-semibold text-[#182034] transition-[filter,transform] hover:brightness-[1.05]"
              >
                Open live simulator
              </Link>
              <Link
                href={demoCheckoutPath}
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(139,170,228,0.5)] bg-[rgba(27,45,74,0.78)] px-4 text-sm font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(36,60,96,0.94)]"
              >
                Open checkout path
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {demoJourney.map(item => {
              const href = salesDemoEntryPath(item.nextPath)
              return (
                <article
                  key={item.step}
                  className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-3 py-3"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4bb8b]">
                    Step {item.step}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-[#f2e8d2]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[rgba(219,208,187,0.84)]">
                    {item.script}
                  </p>
                  <div className="mt-2 text-[11px] text-[rgba(182,203,238,0.86)] mono-font">
                    {item.nextPath}
                  </div>
                  <Link
                    href={href}
                    className="mt-2 inline-flex rounded-[var(--radius-control)] border border-[rgba(149,175,225,0.34)] bg-[rgba(59,85,128,0.24)] px-3 py-1 text-[11px] font-semibold text-[#dae6ff] transition-colors hover:bg-[rgba(59,85,128,0.34)]"
                  >
                    Open step
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="company-reveal company-delay-3 rounded-[24px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(160deg,rgba(8,14,28,0.97),rgba(12,24,45,0.94))] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Capability Coverage
              </div>
              <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
                Every layer needed to run and grow is already represented.
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {capabilityMap.map(group => (
              <article
                key={group.area}
                className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3"
              >
                <h3 className="font-semibold text-[#f2e8d2]">{group.area}</h3>
                <div className="mt-2 space-y-2">
                  {group.items.map(item => (
                    <div
                      key={item}
                      className="rounded-[10px] border border-[rgba(149,175,225,0.24)] bg-[rgba(11,19,34,0.52)] px-3 py-2 text-xs leading-5 text-[rgba(222,234,255,0.9)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-[18px] border border-[rgba(149,175,225,0.34)] bg-[rgba(41,64,104,0.26)] px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bb8b]">
              Stack Signals
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {techSignals.map(item => (
                <span
                  key={item}
                  className="inline-flex rounded-full border border-[rgba(150,176,225,0.36)] bg-[rgba(56,83,129,0.32)] px-3 py-1 text-xs text-[#d9e6ff]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="company-reveal company-delay-4 rounded-[24px] border border-[rgba(201,169,110,0.34)] bg-[linear-gradient(130deg,rgba(6,11,21,0.95),rgba(11,20,36,0.95),rgba(19,37,66,0.9))] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Next Move
              </div>
              <p className="mt-1 text-sm leading-7 text-[rgba(236,227,210,0.86)] md:text-base">
                Run the live simulator, then book a call to scope deployment and
                commercial rollout.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={salesDemoPath}
                className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.7)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-5 py-2 text-sm font-semibold text-[#182034] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.06]"
              >
                Start live demo
              </Link>
              <Link
                href="/contact"
                className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(150,176,225,0.42)] bg-[rgba(56,83,129,0.32)] px-5 py-2 text-sm font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(67,97,148,0.4)]"
              >
                Contact {PUBLIC_SITE_NAME}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
