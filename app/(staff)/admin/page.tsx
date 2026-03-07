import Link from "next/link"
import { AdminSystemControls } from "@/components/admin/AdminSystemControls"
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
        className="pointer-events-none absolute -left-12 top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto max-w-[1440px] space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                Admin Control
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                System-level operations and recovery
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Developer-facing controls for menu management, tenant switching,
                emergency recovery, and environment visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/manager"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Manager console
              </Link>
              <Link
                href="/manager/features"
                className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[rgba(114,153,225,0.56)] bg-[rgba(29,50,81,0.76)] px-3 text-sm font-semibold text-[#dce9ff] transition-colors hover:bg-[rgba(41,67,108,0.92)]"
              >
                Growth tools
              </Link>
            </div>
          </div>
        </Card>

        <OperationsControlCenter role="admin" />
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
                      className="focus-ring inline-flex min-h-[34px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white/70 px-2 text-xs font-medium"
                    >
                      Customer
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/staff-login`}
                      className="focus-ring inline-flex min-h-[34px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white/70 px-2 text-xs font-medium"
                    >
                      Staff Login
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/manager`}
                      className="focus-ring inline-flex min-h-[34px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white/70 px-2 text-xs font-medium"
                    >
                      Manager
                    </Link>
                    <Link
                      href={`/r/${restaurant.slug}?next=/manager/customize`}
                      className="focus-ring inline-flex min-h-[34px] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white/70 px-2 text-xs font-medium"
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
