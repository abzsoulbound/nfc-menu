import { redirect } from "next/navigation"

export default function LegacyTagTableRouteRedirect({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/t/${encodeURIComponent(params.tagId)}/table`)
}
