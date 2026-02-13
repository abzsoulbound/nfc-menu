import { redirect } from "next/navigation"

export default function LegacyTenantMenuRouteRedirect({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(`/order/r/${encodeURIComponent(params.restaurantSlug)}/menu`)
}
