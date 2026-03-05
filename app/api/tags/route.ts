import { badRequest, ok, readJson } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import {
  appendAuditEvent,
  assignTag,
  listTags,
  registerTagScan,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

type RegisterTagBody = {
  tagId?: string
}

type AssignTagBody = {
  tagId?: string | null
  tableId?: string | null
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    try {
      await hydrateRuntimeStateFromDb()
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      return ok(listTags())
    } catch (error) {
      return badRequest((error as Error).message, 401)
    }
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    try {
      await hydrateRuntimeStateFromDb()
      const body = await readJson<RegisterTagBody>(req)
      if (!body.tagId) {
        return badRequest("tagId is required")
      }
      const tag = registerTagScan(body.tagId)
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tags.scanned", { tagId: tag.id })
      return ok({
        id: tag.id,
        tableId: tag.tableId,
        lastSeenAt: tag.lastSeenAt,
      })
    } catch (error) {
      return badRequest((error as Error).message)
    }
  })
}

export async function PATCH(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    try {
      await hydrateRuntimeStateFromDb()
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      const body = await readJson<AssignTagBody>(req)
      if (!body.tagId) {
        return badRequest("tagId is required")
      }
      const updated = assignTag(body.tagId, body.tableId ?? null)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "ASSIGN_TAG",
        targetType: "TAG",
        targetId: body.tagId,
        after: { tableId: body.tableId ?? null },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tags.updated", {
        tagId: body.tagId,
        tableId: body.tableId ?? null,
      })
      return ok({
        id: updated.id,
        tableId: updated.tableId,
        lastSeenAt: updated.lastSeenAt,
      })
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized")
        ? 401
        : 400
      return badRequest(message, status)
    }
  })
}
