import { redirect } from "next/navigation"

export default function LegacyTagReviewPage({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/review/${params.tagId}`)
}
