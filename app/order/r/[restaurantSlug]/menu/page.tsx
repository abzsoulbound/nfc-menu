import { redirect } from "next/navigation"

export default function TenantOrderMenuRedirectPage({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(
    `/order/menu?restaurantSlug=${encodeURIComponent(params.restaurantSlug)}`
  )
}
