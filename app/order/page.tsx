import { redirect } from "next/navigation"

export default function OrderEntryPage({
  searchParams,
}: {
  searchParams: { t?: string }
}) {
  const tableToken = searchParams.t?.trim()
  if (!tableToken) {
    redirect("/menu")
  }

  redirect(`/t/${encodeURIComponent(tableToken)}`)
}
