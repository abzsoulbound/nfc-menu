import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  addStaffMessage,
  addTablePayment,
  addWaitlistEntry,
  appendAuditEvent,
  createDeliveryChannelOrder,
  createReservation,
  exportAuditCsv,
  exportMenuCsv,
  exportOrdersCsv,
  getFeatureSummary,
  getInventoryLowStockThreshold,
  getTableBill,
  getShiftReport,
  getSystemFlags,
  listAuditEvents,
  listCheckoutReceipts,
  listCustomerAccounts,
  listCustomerNotifications,
  listDeliveryChannelOrders,
  listFeedback,
  listInventoryAlerts,
  listLoyaltyAccounts,
  listMenuDayparts,
  listPrintJobs,
  listPromoCodes,
  listReservations,
  listWaitlist,
  markTableBillStatus,
  openTableBill,
  queueCustomerNotification,
  reopenTable,
  removeMenuDaypart,
  resetRuntimeState,
  resetTableContributionWindow,
  retryPrintJob,
  runTableAction,
  setInventoryLowStockThreshold,
  setPromoCodeActive,
  setServiceActive,
  splitTableBill,
  transferTableData,
  updateDeliveryOrderStatus,
  updatePrintJobStatus,
  updateReservationStatus,
  updateWaitlistStatus,
  upsertMenuDaypart,
  upsertPromoCode,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { getRestaurantContextSlug } from "@/lib/tenantContext"
import {
  DeliveryChannel,
  DeliveryOrderStatus,
  PrintJobStatus,
  PromoCodeKind,
  ReservationStatus,
  Station,
  TableBillStatus,
  WaitlistStatus,
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
  | "UPSERT_PROMO"
  | "SET_PROMO_ACTIVE"
  | "UPDATE_RESERVATION_STATUS"
  | "UPDATE_WAITLIST_STATUS"
  | "SEND_NOTIFICATION"
  | "CREATE_DELIVERY_ORDER"
  | "UPDATE_DELIVERY_ORDER_STATUS"
  | "UPSERT_DAYPART"
  | "REMOVE_DAYPART"
  | "SET_LOW_STOCK_THRESHOLD"
  | "CREATE_RESERVATION"
  | "CREATE_WAITLIST_ENTRY"

type ActionBody = {
  action?: StaffAction
  tableId?: string
  sourceTableId?: string
  targetTableId?: string
  splitCount?: number
  amount?: number
  method?: string
  note?: string
  message?: string
  billStatus?: TableBillStatus
  printJobId?: string
  printStatus?: PrintJobStatus
  code?: string
  description?: string
  kind?: PromoCodeKind
  value?: number
  minSpend?: number
  active?: boolean
  startsAt?: string | null
  endsAt?: string | null
  maxUses?: number | null
  reservationId?: string
  reservationStatus?: ReservationStatus
  waitlistId?: string
  waitlistStatus?: WaitlistStatus
  channel?: DeliveryChannel | "SMS" | "EMAIL" | "IN_APP"
  recipient?: string
  relatedType?: string
  relatedId?: string
  deliveryOrderId?: string
  deliveryStatus?: DeliveryOrderStatus
  externalRef?: string
  daypartId?: string
  days?: number[]
  startTime?: string
  endTime?: string
  sectionIds?: string[]
  itemIds?: string[]
  lowStockThreshold?: number
  name?: string
  phone?: string
  partySize?: number
  requestedFor?: string
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
    action === "PRINT_STATUS" ||
    action === "UPSERT_PROMO" ||
    action === "SET_PROMO_ACTIVE" ||
    action === "UPDATE_RESERVATION_STATUS" ||
    action === "UPDATE_WAITLIST_STATUS" ||
    action === "SEND_NOTIFICATION" ||
    action === "CREATE_DELIVERY_ORDER" ||
    action === "UPDATE_DELIVERY_ORDER_STATUS" ||
    action === "UPSERT_DAYPART" ||
    action === "REMOVE_DAYPART" ||
    action === "SET_LOW_STOCK_THRESHOLD" ||
    action === "CREATE_RESERVATION" ||
    action === "CREATE_WAITLIST_ENTRY"
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
  return `${getRestaurantContextSlug()}-${type}-${stamp}.csv`
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
  return withRestaurantRequestContext(req, async () => {
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

    if (view === "feature-summary") {
      requireRole(["MANAGER", "ADMIN"], req)
      return ok(getFeatureSummary())
    }

    if (view === "promos") {
      requireRole(["MANAGER", "ADMIN"], req)
      return ok(listPromoCodes())
    }

    if (view === "reservations") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listReservations(limit))
    }

    if (view === "waitlist") {
      requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listWaitlist(limit))
    }

    if (view === "notifications") {
      requireRole(["MANAGER", "ADMIN"], req)
      const recipient = url.searchParams.get("recipient") ?? undefined
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listCustomerNotifications({ recipient, limit }))
    }

    if (view === "feedback") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listFeedback(limit))
    }

    if (view === "loyalty") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listLoyaltyAccounts(limit))
    }

    if (view === "customers") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listCustomerAccounts(limit))
    }

    if (view === "delivery") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "200")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200
      return ok(listDeliveryChannelOrders(limit))
    }

    if (view === "dayparts") {
      requireRole(["MANAGER", "ADMIN"], req)
      return ok(listMenuDayparts())
    }

    if (view === "inventory-alerts") {
      requireRole(["MANAGER", "ADMIN"], req)
      return ok({
        threshold: getInventoryLowStockThreshold(),
        alerts: listInventoryAlerts(),
      })
    }

    if (view === "receipts") {
      requireRole(["MANAGER", "ADMIN"], req)
      const limitRaw = Number(url.searchParams.get("limit") ?? "100")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 100
      return ok(listCheckoutReceipts(limit))
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
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async () => {
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

    if (body.action === "UPSERT_PROMO") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (
        !body.code ||
        !body.description ||
        !body.kind ||
        typeof body.value !== "number"
      ) {
        return badRequest("code, description, kind, and value are required")
      }
      const promo = upsertPromoCode({
        code: body.code,
        description: body.description,
        kind: body.kind,
        value: body.value,
        minSpend: body.minSpend,
        active: body.active,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        maxUses: body.maxUses,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPSERT_PROMO",
        targetType: "PROMO_CODE",
        targetId: promo.code,
        after: promo,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("promos.updated", { code: promo.code })
      return ok(promo)
    }

    if (body.action === "SET_PROMO_ACTIVE") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.code || typeof body.active !== "boolean") {
        return badRequest("code and active are required")
      }
      const promo = setPromoCodeActive(body.code, body.active)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SET_PROMO_ACTIVE",
        targetType: "PROMO_CODE",
        targetId: promo.code,
        after: { active: promo.active },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("promos.updated", { code: promo.code, active: promo.active })
      return ok(promo)
    }

    if (body.action === "CREATE_RESERVATION") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (
        !body.name ||
        !body.phone ||
        typeof body.partySize !== "number" ||
        !body.requestedFor
      ) {
        return badRequest("name, phone, partySize, and requestedFor are required")
      }
      const reservation = createReservation({
        name: body.name,
        phone: body.phone,
        partySize: body.partySize,
        requestedFor: body.requestedFor,
        note: body.note,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "CREATE_RESERVATION",
        targetType: "RESERVATION",
        targetId: reservation.id,
        after: reservation,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("reservations.updated", { reservationId: reservation.id })
      return ok(reservation)
    }

    if (body.action === "UPDATE_RESERVATION_STATUS") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.reservationId || !body.reservationStatus) {
        return badRequest("reservationId and reservationStatus are required")
      }
      const reservation = updateReservationStatus(
        body.reservationId,
        body.reservationStatus
      )
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPDATE_RESERVATION_STATUS",
        targetType: "RESERVATION",
        targetId: reservation.id,
        after: { status: reservation.status },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("reservations.updated", { reservationId: reservation.id })
      return ok(reservation)
    }

    if (body.action === "CREATE_WAITLIST_ENTRY") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.name || !body.phone || typeof body.partySize !== "number") {
        return badRequest("name, phone, and partySize are required")
      }
      const entry = addWaitlistEntry({
        name: body.name,
        phone: body.phone,
        partySize: body.partySize,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "CREATE_WAITLIST_ENTRY",
        targetType: "WAITLIST",
        targetId: entry.id,
        after: entry,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("waitlist.updated", { waitlistId: entry.id })
      return ok(entry)
    }

    if (body.action === "UPDATE_WAITLIST_STATUS") {
      const staff = requireRole(["WAITER", "MANAGER", "ADMIN"], req)
      if (!body.waitlistId || !body.waitlistStatus) {
        return badRequest("waitlistId and waitlistStatus are required")
      }
      const entry = updateWaitlistStatus(body.waitlistId, body.waitlistStatus)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPDATE_WAITLIST_STATUS",
        targetType: "WAITLIST",
        targetId: entry.id,
        after: { status: entry.status },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("waitlist.updated", { waitlistId: entry.id })
      return ok(entry)
    }

    if (body.action === "SEND_NOTIFICATION") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (
        !body.channel ||
        !body.recipient ||
        !body.message ||
        !body.relatedType ||
        !body.relatedId
      ) {
        return badRequest("channel, recipient, message, relatedType, and relatedId are required")
      }
      if (
        body.channel !== "SMS" &&
        body.channel !== "EMAIL" &&
        body.channel !== "IN_APP"
      ) {
        return badRequest("channel must be SMS, EMAIL, or IN_APP")
      }
      const notification = queueCustomerNotification({
        channel: body.channel,
        recipient: body.recipient,
        message: body.message,
        relatedType: body.relatedType,
        relatedId: body.relatedId,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SEND_NOTIFICATION",
        targetType: "CUSTOMER_NOTIFICATION",
        targetId: notification.id,
        after: notification,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("notifications.updated", { notificationId: notification.id })
      return ok(notification)
    }

    if (body.action === "CREATE_DELIVERY_ORDER") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.channel || !body.externalRef || typeof body.amount !== "number") {
        return badRequest("channel, externalRef, and amount are required")
      }
      if (
        body.channel !== "UBER_EATS" &&
        body.channel !== "DELIVEROO" &&
        body.channel !== "JUST_EAT" &&
        body.channel !== "DIRECT"
      ) {
        return badRequest("Invalid delivery channel")
      }
      const order = createDeliveryChannelOrder({
        channel: body.channel,
        externalRef: body.externalRef,
        total: body.amount,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "CREATE_DELIVERY_ORDER",
        targetType: "DELIVERY_ORDER",
        targetId: order.id,
        after: order,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("delivery.updated", { orderId: order.id })
      return ok(order)
    }

    if (body.action === "UPDATE_DELIVERY_ORDER_STATUS") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.deliveryOrderId || !body.deliveryStatus) {
        return badRequest("deliveryOrderId and deliveryStatus are required")
      }
      const order = updateDeliveryOrderStatus(
        body.deliveryOrderId,
        body.deliveryStatus
      )
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPDATE_DELIVERY_ORDER_STATUS",
        targetType: "DELIVERY_ORDER",
        targetId: order.id,
        after: { status: order.status },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("delivery.updated", { orderId: order.id })
      return ok(order)
    }

    if (body.action === "UPSERT_DAYPART") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (
        !body.name ||
        !Array.isArray(body.days) ||
        !body.startTime ||
        !body.endTime
      ) {
        return badRequest("name, days, startTime, and endTime are required")
      }
      const daypart = upsertMenuDaypart({
        id: body.daypartId,
        name: body.name,
        enabled: body.active,
        days: body.days,
        startTime: body.startTime,
        endTime: body.endTime,
        sectionIds: body.sectionIds,
        itemIds: body.itemIds,
      })
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "UPSERT_DAYPART",
        targetType: "MENU_DAYPART",
        targetId: daypart.id,
        after: daypart,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", { action: "DAYPART_UPSERT", daypartId: daypart.id })
      return ok(daypart)
    }

    if (body.action === "REMOVE_DAYPART") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (!body.daypartId) {
        return badRequest("daypartId is required")
      }
      const result = removeMenuDaypart(body.daypartId)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "REMOVE_DAYPART",
        targetType: "MENU_DAYPART",
        targetId: body.daypartId,
        after: result,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.updated", { action: "DAYPART_REMOVE", daypartId: body.daypartId })
      return ok(result)
    }

    if (body.action === "SET_LOW_STOCK_THRESHOLD") {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      if (typeof body.lowStockThreshold !== "number") {
        return badRequest("lowStockThreshold is required")
      }
      const threshold = setInventoryLowStockThreshold(body.lowStockThreshold)
      appendAuditEvent({
        actorRole: staff.role,
        actorId: staff.id,
        action: "SET_LOW_STOCK_THRESHOLD",
        targetType: "SYSTEM",
        targetId: "low-stock-threshold",
        after: { threshold },
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("menu.stock", { threshold })
      return ok({
        threshold,
        alerts: listInventoryAlerts(),
      })
    }

      return badRequest("Unsupported action")
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized")
        ? 401
        : 400
      return badRequest(message, status)
    }
  })
}

export async function PUT(req: Request) {
  return withRestaurantRequestContext(req, async () => {
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
  })
}
