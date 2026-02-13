import { redirect } from "next/navigation"

export default function OrderEntryPage({
  searchParams,
}: {
  searchParams: { t?: string }
}) {
  const tableToken = searchParams.t?.trim()
  if (!tableToken) {
    redirect("/order/menu")
  }

  redirect(`/order/t/${encodeURIComponent(tableToken)}`)
}
