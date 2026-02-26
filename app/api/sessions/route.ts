import { badRequest, ok, readJson } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import { createOrResumeSession, listSessions } from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { SessionOrigin } from "@/lib/types"

export const dynamic = "force-dynamic"

type SessionBody = {
  sessionId?: string
  origin?: SessionOrigin
  tagId?: string
}

function toOrigin(origin?: string): SessionOrigin {
  if (origin === "STAFF") return "STAFF"
  return "CUSTOMER"
}

export async function GET(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    return ok(listSessions())
  } catch (error) {
    return badRequest((error as Error).message, 401)
  }
}

export async function POST(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<SessionBody>(req)
    const origin = toOrigin(body.origin)
    if (origin === "STAFF") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    }

    const session = createOrResumeSession({
      sessionId: body.sessionId,
      origin,
      tagId: body.tagId,
    })

    const dto = listSessions().find(s => s.id === session.id)
    if (!dto) {
      return badRequest("Unable to create session", 500)
    }
    await persistRuntimeStateToDb()
    publishRuntimeEvent("sessions.updated", {
      sessionId: session.id,
      origin: session.origin,
    })
    return ok(dto)
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}
