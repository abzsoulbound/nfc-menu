import { redirect } from "next/navigation"

export default function TenantRootPage({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(
    `/order/r/${encodeURIComponent(params.restaurantSlug)}/menu`
  )
}
