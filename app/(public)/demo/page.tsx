import { DemoPageClient } from "@/components/demo/DemoPageClient"
import {
  DEMO_CUSTOMER_ROUTE_DEFINITIONS,
  type DemoCustomerRouteKey,
  DEMO_STAFF_ROUTE_DEFINITIONS,
  type DemoStaffRouteKey,
} from "@/lib/demoSetup"
import {
  getRestaurantStaffAuth,
  resolveRestaurantForSlug,
} from "@/lib/restaurants"
import {
  getSalesDemoSlug,
  restaurantEntryPathForSlug,
} from "@/lib/tenant"

export const metadata = {
  title: "Demo Control Centre",
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = "force-dynamic"

function firstPasscode(list: string[] | undefined) {
  const first = list?.find(Boolean)
  if (!first) return "Not set"
  if (first.toLowerCase().startsWith("sha256:v1:")) {
    return "Configured"
  }
  return first
}

export default async function DemoPage() {
  const demoSlug = getSalesDemoSlug()
  await resolveRestaurantForSlug(demoSlug)
  const staffAuth = await getRestaurantStaffAuth(demoSlug)
  const resolveHref = (nextPath: string) =>
    restaurantEntryPathForSlug(demoSlug, nextPath)

  const passcodes = [
    { role: "W", code: firstPasscode(staffAuth.WAITER) },
    { role: "K", code: firstPasscode(staffAuth.KITCHEN) },
    { role: "B", code: firstPasscode(staffAuth.BAR) },
    { role: "M", code: firstPasscode(staffAuth.MANAGER) },
    { role: "A", code: firstPasscode(staffAuth.ADMIN) },
  ]

  const customerRouteHrefs = Object.fromEntries(
    DEMO_CUSTOMER_ROUTE_DEFINITIONS.map(route => [
      route.key,
      resolveHref(route.nextPath),
    ])
  ) as Record<DemoCustomerRouteKey, string>
  const staffRouteHrefs = Object.fromEntries(
    DEMO_STAFF_ROUTE_DEFINITIONS.map(route => [
      route.key,
      resolveHref(route.nextPath),
    ])
  ) as Record<DemoStaffRouteKey, string>

  return (
    <DemoPageClient
      passcodes={passcodes}
      customerRouteHrefs={customerRouteHrefs}
      staffRouteHrefs={staffRouteHrefs}
    />
  )
}
