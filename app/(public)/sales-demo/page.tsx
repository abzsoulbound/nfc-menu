import { redirect } from "next/navigation"

export const metadata = {
  title: "Demo Control Room",
}

export const dynamic = "force-dynamic"

export default function SalesDemoPage() {
  redirect("/demo")
}
