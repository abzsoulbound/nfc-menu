import { redirect } from "next/navigation"

export default function LegacyTableReviewPage({
  params,
}: {
  params: { tableNumber: string }
}) {
  redirect(`/order/${params.tableNumber}/review`)
}
