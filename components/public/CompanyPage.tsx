import Link from "next/link"
import { SoulboundStudioLogo } from "@/components/public/SoulboundStudioLogo"
import {
  PUBLIC_SITE_LAST_UPDATED,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_SERVICE_AREA,
} from "@/lib/publicSite"
import { salesDemoEntryPath } from "@/lib/tenant"

/* ------------------------------------------------------------------ */
/*  Projects — add new entries here to show them on the portfolio     */
/* ------------------------------------------------------------------ */

interface Project {
  title: string
  tagline: string
  description: string
  stack: string[]
  highlights: string[]
  status: "Live" | "Beta" | "In Development" | "Coming Soon"
  /** Internal path (within this app) or full external URL */
  href: string
  ctaLabel: string
  /** If true the CTA link opens in a new tab (use for external URLs) */
  external?: boolean
  /** Accent colour used for the card border glow. Defaults to gold. */
  accent?: string
}

const projects: Project[] = [
  {
    title: "NFC Menu — Restaurant Ordering Platform",
    tagline: "Tap a table, place an order, run the floor.",
    description:
      "A full-stack NFC-powered restaurant ordering and operations system. Guests tap an NFC tag, browse the menu and pay — no app install. Staff get real-time kitchen, bar, waiter & manager dashboards. Multi-tenant SaaS with Stripe Connect billing.",
    stack: [
      "Next.js App Router",
      "TypeScript",
      "PostgreSQL + Prisma",
      "Stripe Connect",
      "Realtime SSE",
      "Playwright + Vitest",
    ],
    highlights: [
      "NFC tap-to-menu with zero app friction",
      "5 role-gated operational surfaces",
      "Live order queues, table sessions & floor state",
      "Multi-tenant onboarding and subscription billing",
      "Full live demo simulator for buyer walkthroughs",
    ],
    status: "Live",
    href: "/demo",
    ctaLabel: "Try the live demo",
  },
  {
    title: "Fable Stores — Inventory & Expiry Tracker",
    tagline: "Track stock, catch expiry, and sync with your POS.",
    description:
      "A native iOS inventory management app built for small food and retail businesses. Tracks products by barcode, logs deliveries with batch expiry dates, auto-consumes stock using FIFO, and flags items expiring soon. Syncs with Lotus Pecas POS for live sales data.",
    stack: [
      "Swift",
      "SwiftUI",
      "SwiftData",
      "Lotus Pecas POS Integration",
    ],
    highlights: [
      "Barcode-based product catalogue with supplier info",
      "Batch-level stock tracking with expiry countdown",
      "FIFO consumption engine synced to POS sales",
      "Dashboard with live totals, expired & expiring-soon alerts",
      "Delivery logging, history, and stats views",
    ],
    status: "In Development",
    href: "https://github.com/abzsoulbound/fable-stores",
    ctaLabel: "View on GitHub",
    external: true,
  },
  {
    title: "Maths Quest — Educational Maths Game",
    tagline: "Learn maths through play, earn points, climb the leaderboard.",
    description:
      "An iOS maths quiz game designed to make arithmetic fun and engaging. Players answer questions across multiple difficulty modes, earn points, unlock custom themes, and compete on a global Firebase leaderboard. Includes a built-in drawing pad for working out and sound effects. Version 1.3 on the App Store.",
    stack: [
      "Swift",
      "SwiftUI",
      "Firebase Firestore",
      "Google AdMob",
      "StoreKit (IAP)",
      "PencilKit",
    ],
    highlights: [
      "Multiple maths modes with adaptive difficulty",
      "Points system with unlockable background themes",
      "Global leaderboard powered by Firebase",
      "Built-in drawing pad (PencilKit) for working out",
      "In-app purchase to remove ads via StoreKit",
    ],
    status: "Live",
    href: "https://github.com/abzsoulbound/maths-quest",
    ctaLabel: "View on GitHub",
    external: true,
  },
  {
    title: "Hinton FC — Club Management App",
    tagline: "One app for fixtures, availability, comms, and payments.",
    description:
      "A Flutter mobile app (iOS + Android) for Hinton Football Club in Enfield. Replaces fragmented chat groups and spreadsheets with a single club-focused system — covering team structure, fixtures, availability, attendance, communications, matchday transport, and fee tracking. Firebase-backed with role-based access for admins, coaches, players, parents, and volunteers.",
    stack: [
      "Flutter / Dart",
      "Firebase Auth",
      "Cloud Firestore",
      "Firebase Cloud Messaging",
      "Cloud Functions",
      "Firebase Storage",
    ],
    highlights: [
      "Role-based access: admin, coach, player, parent, volunteer",
      "Fixtures & training calendar with RSVP and lineup preview",
      "Matchday transport: ride offers, seat booking, auto-lock",
      "Parent mode with safeguarding links for youth players",
      "Push notifications for payment reminders & announcements",
    ],
    status: "In Development",
    href: "https://github.com/abzsoulbound/hinton-fc",
    ctaLabel: "View on GitHub",
    external: true,
  },
]

/* ------------------------------------------------------------------ */

const disciplines = [
  {
    label: "Product Engineering",
    detail:
      "Full-stack applications designed from domain model to deployment pipeline — built to ship, not just demo.",
  },
  {
    label: "Hospitality & Operations Tech",
    detail:
      "Software shaped around real venue workflows: ordering, queue management, floor coordination, and guest journeys.",
  },
  {
    label: "Commercial SaaS Infrastructure",
    detail:
      "Multi-tenant architecture, Stripe billing rails, onboarding flows, and launch-readiness tooling baked into the product.",
  },
  {
    label: "Design-Led Interfaces",
    detail:
      "Polished, tactile UIs with strong visual identity — because surface quality signals engineering quality.",
  },
] as const

const statusColour: Record<Project["status"], string> = {
  Live: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  Beta: "border-sky-400/50 bg-sky-400/15 text-sky-300",
  "In Development":
    "border-amber-400/50 bg-amber-400/15 text-amber-300",
  "Coming Soon":
    "border-violet-400/50 bg-violet-400/15 text-violet-300",
}

export function CompanyPage() {
  return (
    <div className="page-container relative overflow-hidden">
      {/* ── background effects ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(217,174,63,0.2),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(0,18,88,0.26),transparent_42%),linear-gradient(180deg,#000a30_0%,#001258_40%,#001a6e_100%)]"
      />
      <div
        aria-hidden="true"
        className="company-orbit pointer-events-none absolute -left-24 top-28 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(217,174,63,0.3),rgba(217,174,63,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="company-orbit pointer-events-none absolute -right-28 top-64 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,18,88,0.32),rgba(0,18,88,0))] blur-3xl [animation-delay:320ms]"
      />

      <div className="page-container-inner space-y-6">
        {/* ── Hero ── */}
        <section className="company-reveal relative overflow-hidden rounded-[30px] border border-[var(--section-border)] bg-[linear-gradient(126deg,rgba(0,8,36,0.96),rgba(0,18,88,0.95)_44%,rgba(0,26,110,0.93))] px-5 py-6 shadow-[0_40px_100px_-52px_rgba(0,10,48,0.96)] md:px-8 md:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_28%_32%,rgba(217,174,63,0.24),transparent_68%)]"
          />
          <div className="relative space-y-5">
            <Link
              href="/"
              className="focus-ring inline-flex rounded-[var(--radius-control)]"
              aria-label="Go to home page"
            >
              <SoulboundStudioLogo tone="light" className="items-start" />
            </Link>

            <h1 className="max-w-4xl font-[family:var(--font-display)] text-4xl leading-tight tracking-tight text-[var(--page-text)] md:text-6xl">
              Creative technology studio building products people actually use.
            </h1>

            <p className="max-w-3xl text-sm leading-7 text-[var(--page-text-secondary)] md:text-base">
              {PUBLIC_SITE_NAME} designs and ships full-stack software — from
              hospitality platforms and operational tools to consumer-facing
              products. Every project is built to production standard with real
              commercial infrastructure, not just polished prototypes.
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href="#projects"
                className="focus-ring action-surface action-button action-button-lg"
              >
                View projects
              </a>
              <Link
                href="/contact"
                className="focus-ring action-surface action-button action-button-lg"
              >
                Get in touch
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex rounded-full border border-[var(--section-border)] bg-[rgba(217,174,63,0.36)] px-3 py-1 text-black">
                {PUBLIC_SITE_SERVICE_AREA}
              </span>
              <span className="inline-flex rounded-full border border-[rgba(0,18,88,0.34)] bg-[rgba(0,18,88,0.26)] px-3 py-1 text-[var(--page-text)]">
                {projects.length} {projects.length === 1 ? "project" : "projects"} live
              </span>
              <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-3 py-1 text-[var(--page-text-secondary)]">
                Updated {PUBLIC_SITE_LAST_UPDATED}
              </span>
            </div>
          </div>
        </section>

        {/* ── What We Do ── */}
        <section className="company-reveal company-delay-1 rounded-[24px] border border-[var(--section-border)] bg-[linear-gradient(160deg,rgba(0,8,36,0.96),rgba(0,18,88,0.93))] p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-text)]">
            What We Do
          </div>
          <h2 className="mt-2 max-w-3xl font-[family:var(--font-display)] text-4xl leading-tight text-[var(--page-text)]">
            End-to-end product development — from idea to live revenue.
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {disciplines.map(d => (
              <article
                key={d.label}
                className="rounded-[16px] border border-[rgba(232,220,198,0.18)] bg-[rgba(6,12,24,0.55)] px-4 py-4"
              >
                <h3 className="font-semibold text-[var(--page-text)]">{d.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--page-text-secondary)]">
                  {d.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Projects ── */}
        <section
          id="projects"
          className="company-reveal company-delay-2 scroll-mt-6 space-y-4"
        >
          <div className="rounded-[24px] border border-[var(--section-border)] bg-[linear-gradient(158deg,rgba(0,8,36,0.97),rgba(0,18,88,0.94))] p-5 md:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-text)]">
              Projects
            </h2>
          </div>

          {projects.map(project => {
            const resolvedHref =
              project.external || project.href.startsWith("http")
                ? project.href
                : project.href === "/demo"
                  ? "/demo"
                  : salesDemoEntryPath(project.href)

            return (
              <article
                key={project.title}
                className="rounded-[24px] border border-[var(--section-border)] bg-[linear-gradient(158deg,rgba(0,8,36,0.97),rgba(0,18,88,0.94))] p-5 md:p-6"
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                  {/* Left — project info */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-[family:var(--font-display)] text-2xl leading-tight text-[var(--page-text)] md:text-3xl">
                        {project.title}
                      </h3>
                      <span
                        className={`inline-flex rounded-full border px-3 py-0.5 text-[11px] font-semibold ${statusColour[project.status]}`}
                      >
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--page-text)]">
                      {project.tagline}
                    </p>
                    <p className="max-w-2xl text-sm leading-7 text-[var(--page-text-secondary)]">
                      {project.description}
                    </p>

                    <div className="space-y-2">
                      {project.highlights.map(h => (
                        <div
                          key={h}
                          className="rounded-[10px] border border-[rgba(0,18,88,0.24)] bg-[rgba(11,19,34,0.52)] px-3 py-2 text-xs leading-5 text-[var(--page-text-secondary)]"
                        >
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={resolvedHref}
                        {...(project.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="focus-ring action-surface action-button"
                      >
                        {project.ctaLabel}
                      </Link>
                    </div>
                  </div>

                  {/* Right — tech stack */}
                  <aside className="rounded-[22px] border border-[var(--section-border)] bg-[linear-gradient(165deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-4 md:p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-text)]">
                      Tech Stack
                    </div>
                    <div className="mt-3 space-y-2">
                      {project.stack.map(tech => (
                        <div
                          key={tech}
                          className="rounded-[12px] border border-[rgba(150,176,225,0.28)] bg-[rgba(0,10,48,0.52)] px-3 py-2.5 text-sm text-[var(--page-text-secondary)]"
                        >
                          {tech}
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </article>
            )
          })}
        </section>

        {/* ── CTA ── */}
        <section className="company-reveal company-delay-3 rounded-[24px] border border-[var(--section-border)] bg-[linear-gradient(130deg,rgba(0,6,28,0.95),rgba(0,14,60,0.95),rgba(0,26,110,0.9))] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-text)]">
                Get Involved
              </div>
              <p className="mt-1 max-w-xl text-sm leading-7 text-[var(--page-text-secondary)] md:text-base">
                Interested in working together, or just want to see what
                we&apos;re building? Reach out — we&apos;d love to hear from
                you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/contact"
                className="focus-ring action-surface action-button action-button-lg"
              >
                Contact {PUBLIC_SITE_NAME}
              </Link>
              <Link
                href="/demo"
                className="focus-ring action-surface action-button action-button-lg"
              >
                Explore demos
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
