import { badRequest, ok, readJson } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import {
  appendAuditEvent,
  compOrderLine,
  getReadyQueue,
  getSessionOrderProgress,
  getStationQueue,
  getTableReview,
  markStationPreparing,
  markTableDelivered,
  markStationSent,
  refireOrderLine,
  reprintTable,
  submitOrder,
  updatePrintJobStatus,
  voidOrderLine,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { runDemoSimulatorTick } from "@/lib/demoSimulator"
import {
  OrderSubmissionItemDTO,
  PrintJobStatus,
  Station,
} from "@/lib/types"

export const dynamic = "force-dynamic"

type SubmitOrderBody = {
  sessionId?: string
  tagId?: string
  items?: OrderSubmissionItemDTO[]
  idempotencyKey?: string
}

type MarkSentBody = {
  tableNumber?: number
  station?: Station
  lineId?: string
  action?:
    | "DELIVER"
    | "START_PREP"
    | "DELIVER_LINE"
    | "START_PREP_LINE"
    | "MARK_READY_LINE"
    | "VOID_LINE"
    | "COMP_LINE"
    | "REFIRE_LINE"
  reason?: string
}

type ReprintBody = {
  tableNumber?: number
  printJobId?: string
  printStatus?: PrintJobStatus
  note?: string
}

function parseStation(value: string | null): Station | null {
  if (value === "KITCHEN" || value === "BAR") return value
  return null
}

function hasSessionReadAccess(req: Request, sessionId: string) {
  try {
    requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    return true
  } catch {
    const providedSessionId = req.headers.get("x-session-id")
    return !!providedSessionId && providedSessionId === sessionId
  }
}

export async function GET(req: Request) {
  await hydrateRuntimeStateFromDb()
  const simulator = runDemoSimulatorTick()
  if (simulator.changed) {
    await persistRuntimeStateToDb()
    publishRuntimeEvent("demo.simulator", {
      enabled: simulator.status.enabled,
      lastTickAt: simulator.status.lastTickAt,
      kitchenQueue: simulator.status.queue.kitchen,
      barQueue: simulator.status.queue.bar,
      readyQueue: simulator.status.queue.ready,
      activeDemoSessions: simulator.status.activeDemoSessions,
    })
  }
  const url = new URL(req.url)
  const station = parseStation(url.searchParams.get("station"))
  const view = url.searchParams.get("view")

  if (station) {
    try {
      if (station === "KITCHEN") {
        requireRole(["KITCHEN", "MANAGER", "ADMIN"], req)
      } else {
        requireRole(["BAR", "MANAGER", "ADMIN"], req)
      }
    } catch (error) {
      return badRequest((error as Error).message, 401)
    }
    return ok(getStationQueue(station))
  }

  if (view === "ready") {
    try {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    } catch (error) {
      return badRequest((error as Error).message, 401)
    }
    return ok(getReadyQueue())
  }

  if (view === "session") {
    const sessionId = url.searchParams.get("sessionId")
    if (!sessionId) {
      return badRequest("sessionId is required for view=session")
    }
    if (!hasSessionReadAccess(req, sessionId)) {
      return badRequest("Unauthorized: session access denied", 401)
    }
    return ok(getSessionOrderProgress(sessionId))
  }

  const tableNumberRaw = url.searchParams.get("tableNumber")
  if (tableNumberRaw) {
    const tableNumber = Number(tableNumberRaw)
    if (!Number.isFinite(tableNumber)) {
      return badRequest("tableNumber must be numeric")
    }
    try {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    } catch (error) {
      return badRequest((error as Error).message, 401)
    }
    return ok(getTableReview(tableNumber))
  }

  return badRequest(
    "Either station, view=ready, or tableNumber query parameter is required"
  )
}

export async function POST(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<SubmitOrderBody>(req)
    if (!body.sessionId || !body.tagId) {
      return badRequest("sessionId and tagId are required")
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest("items must be a non-empty array")
    }

    const order = submitOrder({
      sessionId: body.sessionId,
      tagId: body.tagId,
      items: body.items,
      idempotencyKey: body.idempotencyKey,
    })
    await persistRuntimeStateToDb()
    publishRuntimeEvent("orders.submitted", {
      tableNumber: order.tableNumber,
      orderId: order.id,
    })
    return ok(order)
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}

export async function PATCH(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<MarkSentBody>(req)

    if (body.action === "VOID_LINE") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.lineId || !body.reason) {
        return badRequest("lineId and reason are required")
      }
      const result = voidOrderLine({
        lineId: body.lineId,
        reason: body.reason,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "VOID_LINE",
        targetType: "ORDER_LINE",
        targetId: body.lineId,
        note: body.reason,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("orders.voided", {
        lineId: body.lineId,
      })
      return ok(result)
    }

    if (body.action === "COMP_LINE") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.lineId || !body.reason) {
        return badRequest("lineId and reason are required")
      }
      const result = compOrderLine({
        lineId: body.lineId,
        reason: body.reason,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "COMP_LINE",
        targetType: "ORDER_LINE",
        targetId: body.lineId,
        note: body.reason,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("orders.comped", {
        lineId: body.lineId,
      })
      return ok(result)
    }

    if (body.action === "REFIRE_LINE") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.lineId || !body.reason) {
        return badRequest("lineId and reason are required")
      }
      const result = refireOrderLine({
        lineId: body.lineId,
        reason: body.reason,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "REFIRE_LINE",
        targetType: "ORDER_LINE",
        targetId: body.lineId,
        note: body.reason,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("orders.refired", {
        lineId: body.lineId,
      })
      return ok(result)
    }

    if (body.action === "DELIVER" || body.action === "DELIVER_LINE") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (typeof body.tableNumber !== "number") {
        return badRequest("tableNumber is required")
      }
      const result = markTableDelivered(
        body.tableNumber,
        body.action === "DELIVER_LINE" && body.lineId
          ? [body.lineId]
          : undefined
      )
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action:
          body.action === "DELIVER_LINE"
            ? "MARK_DELIVERED_LINE"
            : "MARK_DELIVERED",
        targetType:
          body.action === "DELIVER_LINE"
            ? "ORDER_LINE"
            : "TABLE",
        targetId:
          body.action === "DELIVER_LINE"
            ? String(body.lineId)
            : String(body.tableNumber),
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("orders.delivered", {
        tableNumber: body.tableNumber,
      })
      return ok(result)
    }

    if (!parseStation(body.station ?? null)) {
      return badRequest("station must be KITCHEN or BAR")
    }

    let staff
    if (body.station === "KITCHEN") {
      staff = requireRole(["KITCHEN", "MANAGER", "ADMIN"], req)
    } else {
      staff = requireRole(["BAR", "MANAGER", "ADMIN"], req)
    }

    if (
      typeof body.tableNumber !== "number" ||
      !parseStation(body.station ?? null)
    ) {
      return badRequest(
        "tableNumber and station are required"
      )
    }

    if (body.action === "START_PREP" || body.action === "START_PREP_LINE") {
      if (body.action === "START_PREP_LINE" && !body.lineId) {
        return badRequest("lineId is required for START_PREP_LINE")
      }
      const result = markStationPreparing({
        tableNumber: body.tableNumber,
        station: body.station as Station,
        lineIds:
          body.action === "START_PREP_LINE" && body.lineId
            ? [body.lineId]
            : undefined,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action:
          body.action === "START_PREP_LINE"
            ? "START_PREP_LINE"
            : "START_PREP",
        targetType:
          body.action === "START_PREP_LINE"
            ? "ORDER_LINE"
            : "TABLE_STATION",
        targetId:
          body.action === "START_PREP_LINE" && body.lineId
            ? body.lineId
            : `${body.tableNumber}:${body.station}`,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("orders.prepping", {
        tableNumber: body.tableNumber,
        station: body.station,
      })
      return ok(result)
    }

    if (body.action === "MARK_READY_LINE" && !body.lineId) {
      return badRequest("lineId is required for MARK_READY_LINE")
    }

    const result = markStationSent({
      tableNumber: body.tableNumber,
      station: body.station as Station,
      lineIds:
        body.action === "MARK_READY_LINE" && body.lineId
          ? [body.lineId]
          : undefined,
    })
    appendAuditEvent({
      actorRole: staff.role,
      actorId: staff.id,
      action:
        body.action === "MARK_READY_LINE"
          ? "MARK_READY_LINE"
          : "MARK_READY",
      targetType:
        body.action === "MARK_READY_LINE"
          ? "ORDER_LINE"
          : "TABLE_STATION",
      targetId:
        body.action === "MARK_READY_LINE" && body.lineId
          ? body.lineId
          : `${body.tableNumber}:${body.station}`,
      after: result,
    })
    await persistRuntimeStateToDb()
    publishRuntimeEvent("orders.ready", {
      tableNumber: body.tableNumber,
      station: body.station,
    })
    return ok(result)
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}

export async function PUT(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    const body = await readJson<ReprintBody>(req)

    if (body.printJobId && body.printStatus) {
      const result = updatePrintJobStatus({
        jobId: body.printJobId,
        status: body.printStatus,
        note: body.note,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPDATE_PRINT_JOB",
        targetType: "PRINT_JOB",
        targetId: body.printJobId,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("printer.updated", {
        jobId: body.printJobId,
        status: body.printStatus,
      })
      return ok(result)
    }

    if (typeof body.tableNumber !== "number") {
      return badRequest("tableNumber is required")
    }
    const jobs = reprintTable(body.tableNumber)
    appendAuditEvent({
      actorRole: staff.role,
      actorId: staff.id,
      action: "REPRINT_TICKET",
      targetType: "TABLE",
      targetId: String(body.tableNumber),
      after: { jobsCreated: jobs.length },
    })
    await persistRuntimeStateToDb()
    publishRuntimeEvent("orders.reprint", {
      tableNumber: body.tableNumber,
    })
    publishRuntimeEvent("printer.queued", {
      tableNumber: body.tableNumber,
      jobs: jobs.length,
    })
    return ok({ ok: true, jobs })
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}
