import { MinimalMenuBrowser } from "@/components/menu/MinimalMenuBrowser"
import Link from "next/link"
import { isCustomerMinimalModeEnabled } from "@/lib/customerMode"
import { AI_PLACEHOLDER_HERO_URL } from "@/lib/placeholders"
import { getMenuSnapshot } from "@/lib/runtimeStore"
import { getRestaurantForCurrentRequest } from "@/lib/restaurants"
import { withRestaurantContext } from "@/lib/tenantContext"
import { UxPageTracker } from "@/components/ux/UxPageTracker"

export const dynamic = "force-dynamic"

function MenuMetaStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] surface-accent px-4 py-3 md:px-5 md:py-4">
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
        {label}
      </div>
      <div className="mt-1.5 display-font text-xl font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}

export default async function PublicMenuPage() {
  const restaurant = await getRestaurantForCurrentRequest()
  const { menu, locked } = withRestaurantContext(
    restaurant.slug,
    () => getMenuSnapshot()
  )
  const menuConfig = restaurant.experienceConfig.menu
  const uxConfig = restaurant.experienceConfig.ux
  const totalItems = menu.reduce(
    (sum, section) => sum + section.items.length,
    0
  )
  const barItems = menu.reduce(
    (sum, section) =>
      sum +
      section.items.filter(item => item.station === "BAR").length,
    0
  )
  const kitchenItems = totalItems - barItems
  const heroImageUrl =
    restaurant.assets.heroUrl ?? AI_PLACEHOLDER_HERO_URL
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const availabilityLabel = locked
    ? "Ordering paused right now"
    : "Ordering is open"
  const trustMicrocopy = uxConfig.trustMicrocopy
  const trustLabel =
    trustMicrocopy === "HIGH_ASSURANCE"
      ? "Secure checkout, allergen visibility, and order integrity checks enabled."
      : trustMicrocopy === "MINIMAL"
        ? "Simple ordering experience."
        : "Order updates and secure payment are included."
  const discoveryLabel =
    uxConfig.menuDiscovery === "SEARCH_FIRST"
      ? "Search-first browsing"
      : uxConfig.menuDiscovery === "SECTION_FIRST"
        ? "Section-first browsing"
        : "Hero-first browsing"
  const orderingLabel =
    uxConfig.ordering === "INLINE_STEPPER"
      ? "Quick add ordering"
      : uxConfig.ordering === "GUIDED_CONFIGURATOR"
        ? "Guided customization"
        : "Fast sheet ordering"

  return (
    <div className="relative px-4 py-14 md:px-8 md:py-20">
      <UxPageTracker page="menu" step="discover" />
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -left-20 top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(229,170,20,0.24),rgba(229,170,20,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -right-16 top-52 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(0,18,88,0.18),rgba(0,18,88,0))] blur-3xl [animation-delay:260ms]"
      />

      <div className="mx-auto max-w-[1120px] space-y-14">
        <section className="menu-reveal overflow-hidden rounded-3xl border border-[rgba(229,170,20,0.38)] bg-[linear-gradient(128deg,rgba(250,246,239,0.94),rgba(229,170,20,0.08))] shadow-[var(--shadow-soft)]">
          <div className="grid gap-4 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div className="space-y-5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                {restaurant.name}
                {restaurant.location ? ` | ${restaurant.location}` : ""}
              </div>

              <div>
                <h1 className="display-font text-5xl leading-tight tracking-tight text-[var(--text-heading)] md:text-6xl">
                  {menuConfig.heroTitle}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-relaxed text-secondary">
                  {menuConfig.heroSubtitle}
                </p>
              </div>

              {!customerMinimalMode && menuConfig.showMetaStats && (
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4 md:gap-3">
                  <MenuMetaStat label="Sections" value={String(menu.length)} />
                  <MenuMetaStat label="Items" value={String(totalItems)} />
                  <MenuMetaStat label="Kitchen" value={String(kitchenItems)} />
                  <MenuMetaStat label="Bar" value={String(barItems)} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`status-chip ${
                    locked ? "status-chip-danger" : "status-chip-success"
                  }`}
                >
                  {availabilityLabel}
                </span>
                <span className="status-chip status-chip-neutral">
                  {discoveryLabel}
                </span>
                <span className="status-chip status-chip-neutral">
                  {orderingLabel}
                </span>
                <span className="status-chip status-chip-neutral">
                  {menu.length} live sections
                </span>
              </div>

              {!customerMinimalMode && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.58)] px-4 py-3 text-sm leading-relaxed text-secondary">
                  {trustLabel}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  href={menuConfig.primaryCtaHref}
                  className="btn-press focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-action)] bg-[var(--accent-action)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-action-strong)]"
                >
                  {menuConfig.primaryCtaLabel}
                </Link>
                <Link
                  href={menuConfig.secondaryCtaHref}
                  className="btn-press focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.56)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[rgba(255,255,255,0.78)]"
                >
                  {menuConfig.secondaryCtaLabel}
                </Link>
                <Link
                  href="/order/takeaway"
                  className="btn-press focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.56)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[rgba(255,255,255,0.78)]"
                >
                  Start takeaway
                </Link>
              </div>
            </div>

            <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-[rgba(229,170,20,0.25)] shadow-[var(--shadow-soft)]">
              <div
                aria-label={`${restaurant.name} hero image`}
                className="parallax-hero h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url("${heroImageUrl}")` }}
              />

              <div className="pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(20,12,5,0.6),rgba(20,12,5,0))] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(242,232,214,0.94)]">
                Guest ordering ready
              </div>

              {!customerMinimalMode && menuConfig.showPlaceholderNote && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-[var(--border)] bg-[rgba(250,246,239,0.78)] px-3 py-2 text-xs text-secondary backdrop-blur-sm">
                  Temporary AI placeholder artwork in use.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="menu-reveal menu-delay-1 rounded-2xl border border-[var(--border-subtle)] bg-[linear-gradient(160deg,rgba(250,246,239,0.96),rgba(229,170,20,0.06))] p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.56)] px-5 py-4 card-gradient">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                1. Discover
              </div>
              <div className="mt-2 text-base font-semibold leading-relaxed">
                {uxConfig.menuDiscovery === "SEARCH_FIRST"
                  ? "Start with search to find dishes in seconds."
                  : "Jump between sections quickly with clear category rails."}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.56)] px-5 py-4 card-gradient">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                2. Configure
              </div>
              <div className="mt-2 text-base font-semibold leading-relaxed">
                {uxConfig.ordering === "GUIDED_CONFIGURATOR"
                  ? "Use guided option choices for cleaner order accuracy."
                  : uxConfig.ordering === "INLINE_STEPPER"
                    ? "Add items with fewer taps using quick quantity controls."
                    : "Customize with a focused bottom-sheet flow."}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.56)] px-5 py-4 card-gradient">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                3. Complete
              </div>
              <div className="mt-2 text-base font-semibold leading-relaxed">
                {uxConfig.checkout === "GUIDED_SPLIT"
                  ? "Split and settle in guided steps."
                  : uxConfig.checkout === "EXPRESS_FIRST"
                    ? "Use quick-pay paths with recommended tip presets."
                    : "Move from menu to payment in a few taps."}
              </div>
            </div>
          </div>

          {!customerMinimalMode && uxConfig.socialProofMode !== "OFF" && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="status-chip status-chip-success">
                {uxConfig.socialProofMode === "VERIFIED_REVIEWS"
                  ? "Verified guest reviews"
                  : "Verified guest usage"}
              </span>
              <span className="status-chip status-chip-success">
                Evidence-based trust cues
              </span>
              <span className="status-chip status-chip-success">
                Table-safe checkout
              </span>
            </div>
          )}
        </section>

        <MinimalMenuBrowser
          menu={menu}
          sectionImageMap={restaurant.assets.sectionImageMap}
          discoveryFlow={uxConfig.menuDiscovery}
          showProgressAnchors={uxConfig.showProgressAnchors}
        />
      </div>
    </div>
  )
}
