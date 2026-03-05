import Link from "next/link"
import { SoulboundStudiosLogo } from "@/components/public/SoulboundStudiosLogo"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
} from "@/lib/publicSite"
import { salesDemoEntryPath } from "@/lib/tenant"

const taglines = [
  "Software built with purpose.",
  "Tools, platforms, and systems engineered to solve real problems.",
  "From concept to deployed product.",
] as const

const focusAreas = [
  "Full-stack web platforms",
  "SaaS infrastructure",
  "iOS development",
  "Payment systems",
  "Restaurant technology",
  "Automation tools",
  "Developer tooling",
] as const

const technologyStack = [
  "Next.js",
  "TypeScript",
  "Node.js",
  "Stripe",
  "Firebase",
  "Swift / SwiftUI",
  "Python",
  "PostgreSQL",
  "Neon",
  "Vercel",
  "GitHub",
] as const

const salesProofCards = [
  {
    title: "Dedicated owner simulator",
    detail:
      "A live simulator mode can generate realistic guest traffic so buyers see queue pressure and operational flow, not static mockups.",
  },
  {
    title: "Multi-tenant from day one",
    detail:
      "Restaurant context switching, tenant-aware setup, and operator-specific surfaces are already built into the platform architecture.",
  },
  {
    title: "Commercial rails included",
    detail:
      "Stripe Connect onboarding, subscription billing hooks, and platform-fee capability are integrated into the product model.",
  },
] as const

const buyerWalkthrough = [
  "Tap NFC tag and place a realistic customer order",
  "Watch kitchen and bar queues update under load",
  "Open manager controls to prove operational oversight",
  "Close with checkout and recurring revenue path",
] as const

const projects = [
  {
    id: "nfc-platform",
    title: "NFC Restaurant Ordering Platform",
    status: "Commercial SaaS",
    shortDescription:
      "A multi-tenant restaurant SaaS platform that turns NFC tags into instant table-side ordering flows with no app download required.",
    longDescription:
      "Customers tap a table tag and open a mobile ordering interface immediately. The platform handles menu browsing, cart building, checkout, kitchen routing, and staff operations under one infrastructure shared across multiple restaurants.",
    realWorld:
      "Designed for real deployment at Marlo's Brasserie with table-specific URLs and 25 NFC tags mapped to restaurant tables.",
    deploymentUrl: "https://marloskitchen.co.uk/order",
    deploymentLabel: "Live deployment reference",
    features: [
      "NFC table ordering with table-specific URLs",
      "Mobile web ordering without app install",
      "Stripe checkout + Stripe Connect Express onboarding",
      "Multi-tenant architecture for multiple restaurants",
      "Restaurant dashboards for menu, table, staff, and order management",
      "Kitchen workflow and role-based staff permissions",
      "Platform subscription + fee-capable business model",
    ],
    technologies: [
      "Next.js",
      "TypeScript",
      "Node.js",
      "PostgreSQL (Neon)",
      "Stripe",
      "Stripe Connect Express",
      "Vercel",
    ],
    screenshotPlaceholder:
      "Screenshot Placeholder: Mobile table ordering, dashboard, and kitchen workflow UI.",
    githubRepo: "https://github.com/abzsoulbound/nfc-menu",
    githubLabel: "github.com/abzsoulbound/nfc-menu",
  },
  {
    id: "ozdemir-orders",
    title: "Ozdemir Orders",
    status: "Production Internal App",
    shortDescription:
      "An internal iOS order management app for small food businesses to structure ingredient purchasing and supplier ordering.",
    longDescription:
      "Staff manage ingredient items, create purchase orders, track partial completions, and close oldest outstanding requirements first. Orders can be exported to Excel for supplier workflows.",
    realWorld:
      "Built to replace manual ordering processes with structured digital operations for day-to-day purchasing teams.",
    features: [
      "Item database with seller and category metadata",
      "Purchase order creation and active order tracking",
      "Partial completion support with oldest-order-first completion logic",
      "Order history and progress visibility",
      "Excel export for supplier-ready sheets",
      "Firebase authentication + Firestore persistence",
    ],
    technologies: [
      "Swift",
      "SwiftUI",
      "Firebase Auth",
      "Firestore",
      "Excel export tooling",
    ],
    screenshotPlaceholder:
      "Screenshot Placeholder: iOS order dashboard, item list, and completion tracking screens.",
    githubRepo: "https://github.com/abzsoulbound/ozdemir-orders",
    githubLabel: "github.com/abzsoulbound/ozdemir-orders",
  },
  {
    id: "maths-quest",
    title: "Maths Quest (Maths Mania)",
    status: "Education Product",
    shortDescription:
      "A gamified iPad maths app for primary school students focused on turning practice into a reward-based progression system.",
    longDescription:
      "Students solve interactive maths questions, earn points, and progress through levels in a game-like loop designed to keep learning engaging and structured.",
    realWorld:
      "Built as both an educational product and a monetisation experiment through in-app purchases and AdMob integration.",
    features: [
      "Gamified learning loop with points and rewards",
      "Interactive maths question system",
      "Level-based progression design for younger learners",
      "iPad-first UX for classroom/home usage",
      "Planned Firebase-backed services",
      "Planned monetisation via IAP + AdMob",
    ],
    technologies: [
      "Swift",
      "SwiftUI",
      "Firebase (planned backend)",
      "AdMob (planned)",
      "In-App Purchases",
    ],
    screenshotPlaceholder:
      "Screenshot Placeholder: iPad game interface, question flow, and reward progression screen.",
    githubRepo: "https://github.com/abzsoulbound/maths-mania",
    githubLabel: "github.com/abzsoulbound/maths-mania",
  },
] as const

export function CompanyPage() {
  const salesDemoPath = salesDemoEntryPath("/sales-demo")
  const salesDemoMenuPath = salesDemoEntryPath("/menu")

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

              <SoulboundStudiosLogo tone="light" className="items-start" />

              <h1 className="max-w-4xl font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[#f7efdf] md:text-6xl">
                Startup product studio building real software used by real people.
              </h1>

              <p className="max-w-3xl text-sm leading-7 text-[rgba(236,226,206,0.86)] md:text-base">
                Soulbound Studios is a developer-led company focused on product execution, deployment discipline, and solving real operational problems through software.
              </p>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={salesDemoPath}
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.72)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-4 py-2 text-sm font-semibold text-[#1a2236] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.05]"
                >
                  Live owner simulator
                </Link>
                <Link
                  href="/contact"
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.44)] bg-[rgba(9,18,35,0.72)] px-4 py-2 text-sm font-semibold text-[#f2e9d6] transition-colors hover:bg-[rgba(18,34,60,0.9)]"
                >
                  Work with Soulbound
                </Link>
                <a
                  href="https://github.com/abzsoulbound"
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.42)] bg-[rgba(9,18,35,0.72)] px-4 py-2 text-sm font-semibold text-[#f2e9d6] transition-colors hover:bg-[rgba(18,34,60,0.9)]"
                >
                  GitHub profile
                </a>
                <Link
                  href={salesDemoMenuPath}
                  className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(136,167,230,0.44)] bg-[rgba(26,43,72,0.76)] px-4 py-2 text-sm font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(33,56,92,0.92)]"
                >
                  Open demo menu
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex rounded-full border border-[rgba(201,169,110,0.34)] bg-[rgba(201,169,110,0.1)] px-3 py-1 text-[#e4ceaa]">
                  {PUBLIC_SITE_SERVICE_AREA}
                </span>
                <span className="inline-flex rounded-full border border-[rgba(149,175,225,0.34)] bg-[rgba(65,92,139,0.26)] px-3 py-1 text-[#d4e2ff]">
                  3 core software products
                </span>
                <span className="inline-flex rounded-full border border-[rgba(227,219,202,0.2)] bg-[rgba(227,219,202,0.08)] px-3 py-1 text-[rgba(236,229,216,0.9)]">
                  Updated {PUBLIC_SITE_LAST_UPDATED}
                </span>
              </div>
            </div>

            <aside className="rounded-[22px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(165deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-4 md:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Founder
              </div>
              <div className="mt-3 rounded-[14px] border border-[rgba(233,221,199,0.16)] bg-[rgba(6,12,24,0.5)] px-3 py-3">
                <p className="text-base font-semibold text-[#f1e7d2]">
                  Abdullah &quot;Abz&quot; Ozdemir
                </p>
                <p className="mt-1 text-sm leading-6 text-[rgba(234,223,203,0.84)]">
                  Software Engineering student at the University of Leicester, building and shipping production-focused software products through Soulbound Studios.
                </p>
              </div>

              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Tagline
              </div>
              <div className="mt-2 space-y-2">
                {taglines.map(line => (
                  <div
                    key={line}
                    className="rounded-[12px] border border-[rgba(201,169,110,0.24)] bg-[rgba(201,169,110,0.08)] px-3 py-2 text-sm text-[#ebdcbc]"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="company-reveal company-delay-1 rounded-[24px] border border-[rgba(201,169,110,0.3)] bg-[linear-gradient(160deg,rgba(7,13,26,0.96),rgba(11,22,41,0.93))] p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
            About
          </div>
          <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
            A company portfolio built around product execution.
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-[rgba(236,227,210,0.84)] md:text-base">
            Soulbound Studios operates as a modern developer portfolio and startup product studio. The company focus is on building practical systems with clear business value, strong technical foundations, and real deployment outcomes.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {focusAreas.map(area => (
              <span
                key={area}
                className="inline-flex rounded-full border border-[rgba(232,219,196,0.2)] bg-[rgba(8,14,27,0.45)] px-3 py-1 text-xs text-[rgba(237,228,212,0.86)]"
              >
                {area}
              </span>
            ))}
          </div>
        </section>

        <section className="company-reveal company-delay-2 rounded-[24px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(158deg,rgba(8,14,28,0.97),rgba(13,25,47,0.94))] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Platform Sale Readiness
              </div>
              <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
                Built to be sold, not just built.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sales-demo"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.7)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-4 text-sm font-semibold text-[#182034] transition-[filter,transform] hover:brightness-[1.05]"
              >
                Open live simulator
              </Link>
              <Link
                href="/pricing"
                className="focus-ring inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(139,170,228,0.5)] bg-[rgba(27,45,74,0.78)] px-4 text-sm font-semibold text-[#d9e6ff] transition-colors hover:bg-[rgba(36,60,96,0.94)]"
              >
                View pricing
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {salesProofCards.map(card => (
              <article
                key={card.title}
                className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-3"
              >
                <h3 className="font-semibold text-[#f2e8d2]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[rgba(219,208,187,0.84)]">
                  {card.detail}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-[18px] border border-[rgba(149,175,225,0.34)] bg-[rgba(41,64,104,0.26)] px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bb8b]">
              Buyer Walkthrough
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {buyerWalkthrough.map(step => (
                <div
                  key={step}
                  className="rounded-[12px] border border-[rgba(149,175,225,0.28)] bg-[rgba(11,19,34,0.52)] px-3 py-2 text-sm text-[rgba(222,234,255,0.9)]"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="company-reveal company-delay-3 rounded-[24px] border border-[rgba(201,169,110,0.32)] bg-[linear-gradient(160deg,rgba(8,14,28,0.97),rgba(12,24,45,0.94))] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Projects / Products
              </div>
              <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
                Core products built under Soulbound Studios.
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {projects.map(project => (
              <article
                key={project.id}
                className="rounded-[20px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] p-4 md:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-[rgba(201,169,110,0.42)] bg-[rgba(201,169,110,0.12)] px-2 py-[2px] text-[11px] font-semibold tracking-[0.14em] text-[#dec799]">
                    {project.status}
                  </span>
                </div>

                <h3 className="mt-3 font-[family:var(--font-display)] text-3xl leading-tight text-[#f2e8d2]">
                  {project.title}
                </h3>

                <p className="mt-2 text-sm leading-7 text-[rgba(236,227,210,0.84)] md:text-base">
                  {project.shortDescription}
                </p>
                <p className="mt-2 text-sm leading-7 text-[rgba(220,209,188,0.82)]">
                  {project.longDescription}
                </p>
                <p className="mt-2 text-sm leading-7 text-[rgba(201,221,255,0.9)]">
                  {project.realWorld}
                </p>

                {"deploymentUrl" in project ? (
                  <a
                    href={project.deploymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm font-semibold text-[#d8e7ff] underline underline-offset-4 transition-colors hover:text-[#edf4ff]"
                  >
                    {project.deploymentLabel}
                  </a>
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bb8b]">
                      Key Features
                    </div>
                    <ul className="mt-2 space-y-2">
                      {project.features.map(feature => (
                        <li
                          key={feature}
                          className="rounded-[12px] border border-[rgba(229,217,194,0.14)] bg-[rgba(8,14,27,0.46)] px-3 py-2 text-sm leading-6 text-[rgba(235,226,210,0.84)]"
                        >
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bb8b]">
                      Technologies Used
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {project.technologies.map(tech => (
                        <span
                          key={tech}
                          className="inline-flex rounded-full border border-[rgba(147,174,225,0.34)] bg-[rgba(59,85,128,0.3)] px-3 py-1 text-xs text-[#dae6ff]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bb8b]">
                      Screenshot
                    </div>
                    <div className="mt-2 flex aspect-[16/9] items-center justify-center rounded-[14px] border border-dashed border-[rgba(201,169,110,0.46)] bg-[linear-gradient(135deg,rgba(201,169,110,0.08),rgba(101,135,200,0.08))] px-3 text-center text-xs leading-5 text-[rgba(230,219,199,0.88)]">
                      {project.screenshotPlaceholder}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={project.githubRepo}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.44)] bg-[rgba(201,169,110,0.1)] px-3 py-2 text-sm font-semibold text-[#ecd8b4] transition-colors hover:bg-[rgba(201,169,110,0.18)]"
                  >
                    GitHub Repository
                  </a>
                  <span className="inline-flex items-center text-sm text-[rgba(216,225,242,0.84)]">
                    {project.githubLabel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="company-reveal company-delay-4 rounded-[24px] border border-[rgba(201,169,110,0.3)] bg-[linear-gradient(164deg,rgba(7,14,28,0.96),rgba(10,21,42,0.94))] p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
            Technology Stack
          </div>
          <h2 className="mt-2 font-[family:var(--font-display)] text-4xl leading-tight text-[#f6efdf]">
            Production-oriented stack across web, mobile, and payments.
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {technologyStack.map(tech => (
              <span
                key={tech}
                className="inline-flex rounded-full border border-[rgba(150,176,225,0.36)] bg-[rgba(56,83,129,0.32)] px-3 py-1 text-xs text-[#d9e6ff]"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        <section className="company-reveal company-delay-5 rounded-[24px] border border-[rgba(201,169,110,0.34)] bg-[linear-gradient(130deg,rgba(6,11,21,0.95),rgba(11,20,36,0.95),rgba(19,37,66,0.9))] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfb17b]">
                Contact
              </div>
              <p className="mt-1 text-sm leading-7 text-[rgba(236,227,210,0.86)] md:text-base">
                Looking for a software engineer who ships complete products, not just prototypes.
              </p>
            </div>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-[46px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(201,169,110,0.7)] bg-[linear-gradient(135deg,#f1dba2,#c9a96e)] px-5 py-2 text-sm font-semibold text-[#182034] transition-[transform,filter] hover:translate-y-[-1px] hover:brightness-[1.06]"
            >
              Contact {PUBLIC_SITE_NAME}
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
