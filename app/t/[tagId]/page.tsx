import { redirect } from "next/navigation"

export default function LegacyTagOrderPage({
  params,
}: {
  params: { tagId: string }
}) {
  redirect(`/order/${params.tagId}`)
}
