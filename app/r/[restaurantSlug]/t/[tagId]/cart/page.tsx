import { redirect } from "next/navigation"

export default function TenantCartRedirectPage({
  params,
}: {
  params: { restaurantSlug: string; tagId: string }
}) {
  redirect(
    `/r/${encodeURIComponent(params.restaurantSlug)}/t/${encodeURIComponent(
      params.tagId
    )}/review`
  )
}
