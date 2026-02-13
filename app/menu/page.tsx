import { redirect } from "next/navigation"

export default function LegacyMenuRouteRedirect() {
  redirect("/order/menu")
}
