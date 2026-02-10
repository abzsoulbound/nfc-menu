import { log } from "@/lib/logger"

export type TableState =
  | "open"
  | "locked"
  | "stale"
  | "paid"
  | "unpaid"

export function openTable(tableNumber: number) {
  log("INFO", "Table opened", { tableNumber })
}

export function lockTable(tableNumber: number) {
  log("INFO", "Table locked", { tableNumber })
}

export function resolveStaleTable(
  tableNumber: number,
  paid: boolean
) {
  log("WARN", "Table resolved", {
    tableNumber,
    paid,
  })
}