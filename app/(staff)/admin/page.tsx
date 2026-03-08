import Link from "next/link"
import { AdminSystemControls } from "@/components/admin/AdminSystemControls"
import { FeatureManagement } from "@/components/admin/FeatureManagement"
import { MenuControls } from "@/components/admin/MenuControls"
import { OperationsControlCenter } from "@/components/ops/OperationsControlCenter"
import { Card } from "@/components/ui/Card"
import {
  getRestaurantForCurrentRequest,
  listActiveRestaurants,
} from "@/lib/restaurants"

function masked(value: string | undefined) {
  if (!value) return "not set"
  if (value.length <= 2) return "*".repeat(value.length)
  return `${value.slice(0, 1)}***${value.slice(-1)}`
}

export default async function AdminPage() {
  const currentRestaurant = await getRestaurantForCurrentRequest()
  const restaurants = await listActiveRestaurants()
  const environmentSummary = [
    {
      label: "Waiter passcodes",
      value: masked(process.env.WAITER_PASSCODES),
    },
    {
      label: "Kitchen passcodes",
      value: masked(process.env.KITCHEN_PASSCODES),
    },
    {
      label: "Bar passcodes",
      value: masked(process.env.BAR_PASSCODES),
    },
    {
      label: "Manager passcodes",
      value: masked(process.env.MANAGER_PASSCODES),
    },
    {
      label: "Admin passcodes",
      value: masked(process.env.ADMIN_PASSCODES),
    },
    {
      label: "System auth secret",
      value: masked(process.env.SYSTEM_AUTH_SECRET),
    },
  ]

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[image:var(--orb-navy)] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[var(--section-border)] bg-[image:var(--section-gradient)]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.82)]">
                Admin Control
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                System-level operations and recovery
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(255,255,255,0.86)]">
                Developer-facing controls for menu management, tenant switching,
                emergency recovery, and environment visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/manager"
                className="focus-ring action-surface action-button"
              >
                Manager console
              </Link>
              <Link
                href="/manager/features"
                className="focus-ring action-surface action-button"
              >
                Growth tools
              </Link>
            </div>
          </div>
        </Card>

        <OperationsControlCenter role="admin" />
        <FeatureManagement />
        <MenuControls />
        <AdminSystemControls />

        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Tenant Launchpad
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {restaurants.map(restaurant => (
                <div
                  key={restaurant.slug}
                  className="rounded-[var(--radius-control)] border border-[var(--border)] surface-accent p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {restaurant.name}
                      </div>
                      <div className="text-xs text-muted">
                        {restaurant.slug}
                        {restaurant.location
                          ? ` | ${restaurant.location}`
                          : ""}
                      </div>
                    </div>
                    {currentRestaurant.slug === restaurant.slug ? (
                      <span className="mono-font rounded border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.14em]">
                        active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/r/${restaurant.slug}?next=/menu`}
                      className="focus-ring action-surface action-button action-button-sm"
                    >
                      Customer
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/staff-login`}
                      className="focus-ring action-surface action-button action-button-sm"
                    >
                      Staff Login
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/manager`}
                      className="focus-ring action-surface action-button action-button-sm"
                    >
                      Manager
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/manager/customize`}
                      className="focus-ring action-surface action-button action-button-sm"
                    >
                      Customize
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Passcode environment status
            </div>
            <div className="space-y-1 text-sm">
              {environmentSummary.map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-accent px-3 py-2"
                >
                  <span>{item.label}</span>
                  <span className="mono-font text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
