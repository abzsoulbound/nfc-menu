import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  addStaffMessage,
  addTablePayment,
  appendAuditEvent,
  exportAuditCsv,
  exportMenuCsv,
  exportOrdersCsv,
  getTableBill,
  getShiftReport,
  getSystemFlags,
  listAuditEvents,
  listPrintJobs,
  markTableBillStatus,
  openTableBill,
  reopenTable,
  resetRuntimeState,
  resetTableContributionWindow,
  retryPrintJob,
  runTableAction,
  setServiceActive,
  splitTableBill,
  transferTableData,
  updatePrintJobStatus,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import {
  PrintJobStatus,
  Station,
  TableBillStatus,
} from "@/lib/types"

export const dynamic = "force-dynamic"

type StaffAction =
  | "LOCK_TABLE"
  | "UNLOCK_TABLE"
  | "CLOSE_PAID"
  | "CLOSE_UNPAID"
  | "REOPEN_TABLE"
  | "RESET_TABLE_TIMER"
  | "SERVICE_LOCK"
  | "SERVICE_UNLOCK"
  | "RESET_RUNTIME"
  | "TRANSFER_TABLE"
  | "MERGE_TABLE"
  | "SPLIT_ADDONS"
  | "OPEN_BILL"
  | "SPLIT_BILL"
  | "ADD_PAYMENT"
  | "MARK_BILL_STATUS"
  | "PRINT_RETRY"
  | "PRINT_STATUS"

type ActionBody = {
  action?: StaffAction
  tableId?: string
  sourceTableId?: string
  targetTableId?: string
  splitCount?: number
  amount?: number
  method?: string
  note?: string
  billStatus?: TableBillStatus
  printJobId?: string
  printStatus?: PrintJobStatus
}

type MessageBody = {
  tableId?: string
  target?: Station
  message?: string
}

type ExportDataset = "orders" | "menu" | "audit"

function isStation(target: string | undefined): target is Station {
  return target === "KITCHEN" || target === "BAR"
}

function isStaffAction(action: string | undefined): action is StaffAction {
  return (
    action === "LOCK_TABLE" ||
    action === "UNLOCK_TABLE" ||
    action === "CLOSE_PAID" ||
    action === "CLOSE_UNPAID" ||
    action === "REOPEN_TABLE" ||
    action === "RESET_TABLE_TIMER" ||
    action === "SERVICE_LOCK" ||
    action === "SERVICE_UNLOCK" ||
    action === "RESET_RUNTIME" ||
    action === "TRANSFER_TABLE" ||
    action === "MERGE_TABLE" ||
    action === "SPLIT_ADDONS" ||
    action === "OPEN_BILL" ||
    action === "SPLIT_BILL" ||
    action === "ADD_PAYMENT" ||
    action === "MARK_BILL_STATUS" ||
    action === "PRINT_RETRY" ||
    action === "PRINT_STATUS"
  )
}

function toTransferMode(action: StaffAction) {
  if (action === "TRANSFER_TABLE") return "TRANSFER" as const
  if (action === "MERGE_TABLE") return "MERGE" as const
  return "SPLIT_ADDONS" as const
}

function toExportFilename(type: ExportDataset) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
  return `fable-${type}-${stamp}.csv`
}

function csvResponse(type: ExportDataset, csv: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=\"${toExportFilename(
        type
      )}\"`,
    },
  })
}

function parseExportType(value: string | null): ExportDataset | null {
  if (value === "orders" || value === "menu" || value === "audit") {
    return value
  }
  return null
}

export async function GET(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const url = new URL(req.url)
    const view = url.searchParams.get("view")

    if (!view || view === "flags") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      return ok(getSystemFlags())
    }

    if (view === "report") {
      requireRole(["MANAGER", "ADMIN"], req)
      return ok(getShiftReport())
    }

    if (view === "audit") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "100")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 100
      return ok(listAuditEvents(limit))
    }

    if (view === "bill") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      const tableId = url.searchParams.get("tableId")
      if (!tableId) {
        return badRequest("tableId is required")
      }
      return ok(getTableBill(tableId))
    }

    if (view === "prints") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      const station = url.searchParams.get("station")
      const status = url.searchParams.get("status")
      return ok(
        listPrintJobs({
          station:
            station === "KITCHEN" || station === "BAR"
              ? station
              : undefined,
          status:
            status === "QUEUED" ||
            status === "PRINTED" ||
            status === "FAILED"
              ? status
              : undefined,
        })
      )
    }

    if (view === "export") {
      const type = parseExportType(url.searchParams.get("type"))
      if (!type) {
        return badRequest("type must be one of: orders, menu, audit")
      }

      if (type === "orders") {
        requireRole(["MANAGER", "ADMIN"], req)
        return csvResponse(type, exportOrdersCsv())
      }

      if (type === "menu") {
        requireRole(["MANAGER", "ADMIN"], req)
        return csvResponse(type, exportMenuCsv())
      }

      requireRole(["ADMIN"], req)
      return csvResponse(type, exportAuditCsv())
    }

    return badRequest("Unsupported view")
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}

export async function POST(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<ActionBody>(req)
    if (!isStaffAction(body.action)) {
      return badRequest("valid action is required")
    }

    if (
      body.action === "LOCK_TABLE" ||
      body.action === "UNLOCK_TABLE" ||
      body.action === "CLOSE_PAID" ||
      body.action === "CLOSE_UNPAID"
    ) {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.tableId) {
        return badRequest("tableId is required")
      }

      const table = runTableAction({
        action: body.action,
        tableId: body.tableId,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: body.action,
        targetType: "TABLE",
        targetId: body.tableId,
        after: table,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tables.updated", {
        action: body.action,
        tableId: body.tableId,
      })

      return ok(table)
    }

    if (body.action === "REOPEN_TABLE") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.tableId) {
        return badRequest("tableId is required")
      }
      const table = reopenTable(body.tableId)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "REOPEN_TABLE",
        targetType: "TABLE",
        targetId: body.tableId,
        after: table,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tables.updated", {
        action: "REOPEN_TABLE",
        tableId: body.tableId,
      })
      return ok(table)
    }

    if (body.action === "RESET_TABLE_TIMER") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.tableId) {
        return badRequest("tableId is required")
      }
      const table = resetTableContributionWindow(body.tableId)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "RESET_TABLE_TIMER",
        targetType: "TABLE",
        targetId: body.tableId,
        after: table,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tables.updated", {
        action: "RESET_TABLE_TIMER",
        tableId: body.tableId,
      })
      return ok(table)
    }

    if (body.action === "SERVICE_LOCK") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      setServiceActive(true)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SERVICE_LOCK",
        targetType: "SYSTEM",
        targetId: "service-lock",
        after: getSystemFlags(),
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("service.locked", {
        by: staff.role,
      })
      return ok(getSystemFlags())
    }

    if (body.action === "SERVICE_UNLOCK") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      setServiceActive(false)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SERVICE_UNLOCK",
        targetType: "SYSTEM",
        targetId: "service-lock",
        after: getSystemFlags(),
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("service.unlocked", {
        by: staff.role,
      })
      return ok(getSystemFlags())
    }

    if (body.action === "RESET_RUNTIME") {
      const staff = requireRole(["ADMIN"], req)
      const result = resetRuntimeState()
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "RESET_RUNTIME",
        targetType: "SYSTEM",
        targetId: "runtime-state",
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("runtime.reset", { by: staff.role })
      return ok(result)
    }

    if (
      body.action === "TRANSFER_TABLE" ||
      body.action === "MERGE_TABLE" ||
      body.action === "SPLIT_ADDONS"
    ) {
      const staff = requireRole(
        ["WAITER", "MANAGER", "ADMIN"],
        req
      )
      if (!body.sourceTableId || !body.targetTableId) {
        return badRequest("sourceTableId and targetTableId are required")
      }

      const result = transferTableData({
        sourceTableId: body.sourceTableId,
        targetTableId: body.targetTableId,
        mode: toTransferMode(body.action),
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: body.action,
        targetType: "TABLE_TRANSFER",
        targetId: `${body.sourceTableId}->${body.targetTableId}`,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("tables.transferred", {
        action: body.action,
        sourceTableId: body.sourceTableId,
        targetTableId: body.targetTableId,
      })
      return ok(result)
    }

    if (body.action === "OPEN_BILL") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.tableId) {
        return badRequest("tableId is required")
      }
      const result = openTableBill(body.tableId)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "OPEN_BILL",
        targetType: "TABLE_BILL",
        targetId: body.tableId,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("billing.updated", { tableId: body.tableId })
      return ok(result)
    }

    if (body.action === "SPLIT_BILL") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.tableId || typeof body.splitCount !== "number") {
        return badRequest("tableId and splitCount are required")
      }
      const result = splitTableBill(body.tableId, body.splitCount)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SPLIT_BILL",
        targetType: "TABLE_BILL",
        targetId: body.tableId,
        after: { splitCount: body.splitCount },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("billing.updated", { tableId: body.tableId })
      return ok(result)
    }

    if (body.action === "ADD_PAYMENT") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.tableId || typeof body.amount !== "number") {
        return badRequest("tableId and amount are required")
      }
      const result = addTablePayment({
        tableId: body.tableId,
        amount: body.amount,
        method: body.method,
        note: body.note,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "ADD_PAYMENT",
        targetType: "TABLE_BILL",
        targetId: body.tableId,
        after: { amount: body.amount, method: body.method ?? "manual" },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("billing.updated", { tableId: body.tableId })
      return ok(result)
    }

    if (body.action === "MARK_BILL_STATUS") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.tableId || !body.billStatus) {
        return badRequest("tableId and billStatus are required")
      }
      const result = markTableBillStatus(body.tableId, body.billStatus)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "MARK_BILL_STATUS",
        targetType: "TABLE_BILL",
        targetId: body.tableId,
        after: { billStatus: body.billStatus },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("billing.updated", { tableId: body.tableId })
      return ok(result)
    }

    if (body.action === "PRINT_RETRY") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.printJobId) {
        return badRequest("printJobId is required")
      }
      const result = retryPrintJob(body.printJobId)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "PRINT_RETRY",
        targetType: "PRINT_JOB",
        targetId: body.printJobId,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("printer.updated", {
        jobId: body.printJobId,
      })
      return ok(result)
    }

    if (body.action === "PRINT_STATUS") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.printJobId || !body.printStatus) {
        return badRequest("printJobId and printStatus are required")
      }
      const result = updatePrintJobStatus({
        jobId: body.printJobId,
        status: body.printStatus,
        note: body.note,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "PRINT_STATUS",
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
    return badRequest("Unsupported action")
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
    const body = await readJson<MessageBody>(req)
    if (!body.tableId || !isStation(body.target)) {
      return badRequest("tableId and target are required")
    }
    if (!body.message || body.message.trim() === "") {
      return badRequest("message is required")
    }

    const message = addStaffMessage({
      tableId: body.tableId,
      target: body.target,
      message: body.message.trim(),
    })
    appendAuditEvent({
      actorRole: staff.role,
      actorId: staff.id,
      action: "ADD_STAFF_MESSAGE",
      targetType: "TABLE_STATION",
      targetId: `${body.tableId}:${body.target}`,
      note: body.message.trim(),
    })
    await persistRuntimeStateToDb()
    publishRuntimeEvent("staff.message", {
      tableId: body.tableId,
      target: body.target,
    })

    return ok(message)
  } catch (error) {
    const message = (error as Error).message
    const status = message.startsWith("Unauthorized")
      ? 401
      : 400
    return badRequest(message, status)
  }
}
