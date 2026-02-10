import { log } from "@/lib/logger"

export function registerTagScan(tagId: string) {
  log("INFO", "Tag scanned", { tagId })
}

export function assignTagToTable(
  tagId: string,
  tableNumber: number
) {
  log("INFO", "Tag assigned", {
    tagId,
    tableNumber,
  })
}