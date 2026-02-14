import { redirect } from "next/navigation"

export default function LegacyTenantMenuRouteRedirect({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(
    `/order/menu?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
