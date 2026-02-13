import { redirect } from "next/navigation"

export default function LegacyTagReviewRouteRedirect({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/t/${encodeURIComponent(params.tagId)}/review`)
}
