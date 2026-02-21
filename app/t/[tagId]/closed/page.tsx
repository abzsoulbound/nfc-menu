import { redirect } from "next/navigation"

export default async function LegacyTagClosedRouteRedirect({
  params,
}: {
  params: Promise<{ tagId: string }>
}) {
  const { tagId } = await params
  redirect(`/order/t/${encodeURIComponent(tagId)}/closed`)
}
