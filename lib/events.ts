import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getActorType } from "@/lib/auth"

type EventMeta = {
  req?: Request
  sessionId?: string | null
  tableId?: string | null
  orderId?: string | null
  actor?: string
}

function toJson(payload: unknown): Prisma.InputJsonValue {
  if (payload === undefined) return {} as Prisma.InputJsonValue
  return payload as Prisma.InputJsonValue
}

export async function appendSystemEvent(
  type: string,
  payload: unknown,
  meta: EventMeta = {}
) {
  try {
    await prisma.systemEvent.create({
      data: {
        type,
        payload: toJson(payload),
        actor: meta.actor ?? (meta.req ? getActorType(meta.req) : "system"),
        sessionId: meta.sessionId ?? null,
        tableId: meta.tableId ?? null,
        orderId: meta.orderId ?? null,
      },
    })
  } catch (error) {
    // Event logging must never break the primary request path.
    console.error("system_event_write_failed", { type, error })
  }
}
