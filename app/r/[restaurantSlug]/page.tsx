import { redirect } from "next/navigation"

export default function TenantRootPage({
  params,
}: {
  params: { restaurantSlug: string }
}) {
  redirect(`/r/${encodeURIComponent(params.restaurantSlug)}/menu`)
}
