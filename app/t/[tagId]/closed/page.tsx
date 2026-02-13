import { redirect } from "next/navigation"

export default function LegacyTagClosedRouteRedirect({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/t/${encodeURIComponent(params.tagId)}/closed`)
}
