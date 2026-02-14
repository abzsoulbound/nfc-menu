import { redirect } from "next/navigation"

export default function TenantOrderTagReviewRedirectPage({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/order/t/${encodeURIComponent(
      params.tagId
    )}/review?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
