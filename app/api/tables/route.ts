import { badRequest, ok } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import { getTable, listTables } from "@/lib/runtimeStore"
import { hydrateRuntimeStateFromDb } from "@/lib/runtimePersistence"
import type { TableDTO } from "@/lib/types"

export const dynamic = "force-dynamic"

function toPublicTableView(table: TableDTO) {
  return {
    id: table.id,
    number: table.number,
    locked: table.locked,
    stale: table.stale,
    closed: table.closed,
    paid: table.paid,
    openedAt: table.openedAt,
    contributionWindowEndsAt: table.contributionWindowEndsAt,
  }
}

export async function GET(req: Request) {
  await hydrateRuntimeStateFromDb()
  const url = new URL(req.url)
  const tableId = url.searchParams.get("tableId")

  if (!tableId) {
    try {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    } catch (error) {
      return badRequest((error as Error).message, 401)
    }

    return ok(listTables())
  }

  const table = getTable(tableId)
  if (!table) {
    return badRequest("Table not found", 404)
  }

  try {
    requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    return ok(table)
  } catch {
    return ok(toPublicTableView(table))
  }
}
