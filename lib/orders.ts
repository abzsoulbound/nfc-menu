import { log } from "@/lib/logger"

export function validateOrder(order: any) {
  if (!order.items || order.items.length === 0) {
    throw new Error("Empty order")
  }
}

export function splitByStation(items: any[]) {
  return {
    kitchen: items.filter(i => i.station === "kitchen"),
    bar: items.filter(i => i.station === "bar"),
  }
}

export function markStationComplete(
  orderId: string,
  station: "kitchen" | "bar"
) {
  log("INFO", "Station completed", { orderId, station })
}
