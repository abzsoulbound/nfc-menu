import { QueueUrgency, UiMode } from "@/lib/types"

const STAFF_PREFIXES = [
  "/staff-login",
  "/staff",
  "/waiter",
  "/kitchen",
  "/bar",
  "/manager",
  "/admin",
]

export function resolveUiMode(pathname: string): UiMode {
  if (STAFF_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return "staff"
  }
  return "customer"
}

export function contextLabelForPath(pathname: string) {
  if (pathname.startsWith("/staff-login")) return "Staff Access"
  if (pathname.startsWith("/waiter") || pathname.startsWith("/staff")) {
    return "Waiter"
  }
  if (pathname.startsWith("/kitchen")) return "Kitchen"
  if (pathname.startsWith("/bar")) return "Bar"
  if (pathname.startsWith("/manager")) return "Manager"
  if (pathname.startsWith("/admin")) return "Admin"
  if (pathname.startsWith("/order/") || pathname.startsWith("/t/")) {
    return "Order"
  }
  return "Menu"
}

export function queueUrgencyFromMinutes(ageMinutes: number): QueueUrgency {
  if (ageMinutes > 10) return "critical"
  if (ageMinutes > 5) return "watch"
  return "normal"
}

export function queueUrgencyLabel(urgency: QueueUrgency) {
  if (urgency === "critical") return "Critical"
  if (urgency === "watch") return "Watch"
  return "Normal"
}
