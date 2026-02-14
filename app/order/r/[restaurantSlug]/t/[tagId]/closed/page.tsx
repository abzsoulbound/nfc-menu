import { redirect } from "next/navigation"

export default function TenantOrderTagClosedRedirectPage({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/order/t/${encodeURIComponent(
      params.tagId
    )}/closed?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
