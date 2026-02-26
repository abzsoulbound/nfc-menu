import { log } from "@/lib/logger"

export function validateOrder(order: any) {
  if (!order.items || order.items.length === 0) {
    throw new Error("Empty order")
  }
}

export function splitByStation(items: any[]) {
  return {
    kitchen: items.filter(i => i.station === "KITCHEN"),
    bar: items.filter(i => i.station === "BAR"),
  }
}

export function markStationComplete(
  orderId: string,
  station: "KITCHEN" | "BAR"
) {
  log("INFO", "Station completed", { orderId, station })
}
