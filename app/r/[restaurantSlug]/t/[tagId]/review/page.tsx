import { redirect } from "next/navigation"

export default function LegacyTenantTagReviewRouteRedirect({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/order/r/${encodeURIComponent(
      params.restaurantSlug
    )}/t/${encodeURIComponent(params.tagId)}/review`
  )
}
