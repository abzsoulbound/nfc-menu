import { MinimalMenuBrowser } from "@/components/menu/MinimalMenuBrowser"
import Link from "next/link"
import { BRAND_ASSETS, BRAND_LOCATION } from "@/lib/brand"
import { isCustomerMinimalModeEnabled } from "@/lib/customerMode"
import { AI_PLACEHOLDER_HERO_URL } from "@/lib/placeholders"
import { getMenuSnapshot } from "@/lib/runtimeStore"

export const dynamic = "force-dynamic"

function MenuMetaStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] surface-accent px-3 py-2 md:px-4 md:py-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}

export default async function PublicMenuPage() {
  const { menu, locked } = getMenuSnapshot()
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
  const heroImageUrl = BRAND_ASSETS.heroUrl ?? AI_PLACEHOLDER_HERO_URL
  const customerMinimalMode = isCustomerMinimalModeEnabled()

  return (
    <div className="px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[1120px] space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] surface-secondary shadow-[var(--shadow-soft)]">
          <div className="grid gap-4 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div className="space-y-4">
              <div className="text-[11px] uppercase tracking-[0.34em] text-muted">
                Fable Stores | {BRAND_LOCATION}
              </div>

              <div>
                <h1 className="display-font text-4xl tracking-tight md:text-5xl">
                  Main Menu
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-secondary">
                  Breakfast, brunch, signature mains, handcrafted pizzas, and a full drinks list.
                </p>
              </div>

              {!customerMinimalMode && (
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4 md:gap-3">
                  <MenuMetaStat label="Sections" value={String(menu.length)} />
                  <MenuMetaStat label="Items" value={String(totalItems)} />
                  <MenuMetaStat label="Kitchen" value={String(kitchenItems)} />
                  <MenuMetaStat label="Bar" value={String(barItems)} />
                </div>
              )}

              <div>
                <span
                  className={`status-chip ${
                    locked ? "status-chip-danger" : "status-chip-success"
                  }`}
                >
                  {locked ? "Unavailable" : "Available"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/guest-tools"
                  className="focus-ring inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-xs font-semibold"
                >
                  Guest tools
                </Link>
                <Link
                  href="/pay/1"
                  className="focus-ring inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--accent-quiet)] px-3 text-xs font-semibold"
                >
                  Pay table
                </Link>
              </div>
            </div>

            <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-[var(--border)] surface-elevated">
              <div
                aria-label="Fable Stores hero image"
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url("${heroImageUrl}")` }}
              />

              {!customerMinimalMode && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-[var(--border)] bg-[rgba(255,250,240,0.78)] px-3 py-2 text-xs text-secondary backdrop-blur-sm">
                  Temporary AI placeholder artwork in use.
                </div>
              )}
            </div>
          </div>
        </section>

        <MinimalMenuBrowser
          menu={menu}
          sectionImageMap={BRAND_ASSETS.sectionImageMap}
        />
      </div>
    </div>
  )
}
