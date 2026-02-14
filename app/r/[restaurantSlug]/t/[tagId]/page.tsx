import { redirect } from "next/navigation"

export default function LegacyTenantTagRouteRedirect({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/order/t/${encodeURIComponent(
      params.tagId
    )}?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
