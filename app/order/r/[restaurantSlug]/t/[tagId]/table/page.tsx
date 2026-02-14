import { redirect } from "next/navigation"

export default function TenantOrderTagTableRedirectPage({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/order/t/${encodeURIComponent(
      params.tagId
    )}/table?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
