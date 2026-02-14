import { redirect } from "next/navigation"

export default function TenantRootPage({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(
    `/order/menu?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
