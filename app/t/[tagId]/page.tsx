import { redirect } from "next/navigation"

export default function LegacyTagRouteRedirect({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/t/${encodeURIComponent(params.tagId)}`)
}
