import { redirect } from "next/navigation"

export default async function OrderEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const tableToken = resolvedSearchParams.t?.trim()
  if (!tableToken) {
    redirect("/order/menu")
  }

  redirect(`/order/t/${encodeURIComponent(tableToken)}`)
}
