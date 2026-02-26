import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  exportRuntimeStateSnapshot,
  importRuntimeStateSnapshot,
} from "@/lib/runtimeStore"

const RUNTIME_HISTORY_ID = "runtime:state:v1"
const RUNTIME_META_ID = "default"
const RETRY_BACKOFF_MS = 30_000

let hydratedAt = 0
let hydrating: Promise<void> | null = null
let disabledUntil = 0

type RuntimeSnapshot = {
  history?: Record<
    string,
    {
      id: string
      data: Record<string, unknown>
      updatedAt: string
    }
  >
  tables?: Array<Record<string, unknown>>
  tags?: Array<Record<string, unknown>>
  sessions?: Array<Record<string, unknown>>
  orders?: Array<Record<string, unknown>>
  staffMessages?: Array<Record<string, unknown>>
  reprints?: Array<Record<string, unknown>>
  payments?: Array<Record<string, unknown>>
  printJobs?: Array<Record<string, unknown>>
  auditTrail?: Array<Record<string, unknown>>
  idempotencyRecords?: Record<string, Record<string, unknown>>
}

function canAttemptPersistence() {
  if (!process.env.DATABASE_URL) return false
  return Date.now() >= disabledUntil
}

function markPersistenceFailure() {
  disabledUntil = Date.now() + RETRY_BACKOFF_MS
}

function asIso(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function asDate(value: unknown) {
  if (typeof value === "string" || value instanceof Date) {
    return new Date(value)
  }
  return new Date()
}

function toRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toRelationalRuntimeSnapshot(input: RuntimeSnapshot) {
  const history = input.history ?? {}

  return {
    menu:
      history["menu:current"]?.data?.menu ??
      [],
    flags:
      history["system:flags"]?.data ?? { serviceActive: false },
    tables: Array.isArray(input.tables) ? input.tables : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    orders: Array.isArray(input.orders) ? input.orders : [],
    staffMessages: Array.isArray(input.staffMessages)
      ? input.staffMessages
      : [],
    reprints: Array.isArray(input.reprints) ? input.reprints : [],
    payments: Array.isArray(input.payments) ? input.payments : [],
    printJobs: Array.isArray(input.printJobs) ? input.printJobs : [],
    auditTrail: Array.isArray(input.auditTrail) ? input.auditTrail : [],
    idempotencyRecords:
      input.idempotencyRecords && typeof input.idempotencyRecords === "object"
        ? input.idempotencyRecords
        : {},
  }
}

export async function hydrateRuntimeStateFromDb(options?: {
  force?: boolean
}) {
  if (!canAttemptPersistence()) return
  const force = options?.force === true
  if (!force && Date.now() - hydratedAt < 2_000) {
    return
  }
  if (hydrating) {
    await hydrating
    return
  }

  hydrating = (async () => {
    try {
      const [meta, tables] = await Promise.all([
        prisma.runtimeMeta.findUnique({
          where: { id: RUNTIME_META_ID },
        }),
        prisma.runtimeTableState.findMany({
          orderBy: { number: "asc" },
        }),
      ])

      if (meta && tables.length > 0) {
        const [
          tags,
          sessions,
          orders,
          staffMessages,
          reprints,
          payments,
          printJobs,
          auditTrail,
          idempotencyRecords,
        ] = await Promise.all([
          prisma.runtimeTagState.findMany(),
          prisma.runtimeSessionState.findMany(),
          prisma.runtimeOrderState.findMany({
            include: { items: true },
          }),
          prisma.runtimeStaffMessageState.findMany(),
          prisma.runtimeReprintState.findMany(),
          prisma.runtimePaymentState.findMany(),
          prisma.runtimePrintJobState.findMany(),
          prisma.runtimeAuditState.findMany({
            orderBy: { createdAt: "desc" },
          }),
          prisma.runtimeIdempotencyState.findMany(),
        ])

        const snapshot: RuntimeSnapshot = {
          history: {
            "menu:current": {
              id: "menu:current",
              data: { menu: meta.menu as unknown as Record<string, unknown>[] },
              updatedAt: meta.updatedAt.toISOString(),
            },
            "system:flags": {
              id: "system:flags",
              data: toRecord(meta.flags),
              updatedAt: meta.updatedAt.toISOString(),
            },
          },
          tables: tables.map(table => ({
            id: table.id,
            number: table.number,
            locked: table.locked,
            stale: table.stale,
            closeStatus: table.closeStatus,
            billStatus: table.billStatus,
            splitCount: table.splitCount,
            openedAt: table.openedAt.toISOString(),
            contributionWindowEndsAt:
              table.contributionWindowEndsAt.toISOString(),
          })),
          tags: tags.map(tag => ({
            id: tag.id,
            active: tag.active,
            tableId: tag.tableId,
            lastSeenAt: tag.lastSeenAt.toISOString(),
            createdAt: tag.createdAt.toISOString(),
          })),
          sessions: sessions.map(session => ({
            id: session.id,
            origin: session.origin,
            tagId: session.tagId,
            tableId: session.tableId,
            lastActivityAt: session.lastActivityAt.toISOString(),
            createdAt: session.createdAt.toISOString(),
          })),
          orders: orders.map(order => ({
            id: order.id,
            sessionId: order.sessionId,
            tagId: order.tagId,
            tableId: order.tableId,
            tableNumber: order.tableNumber,
            submittedAt: order.submittedAt.toISOString(),
            items: order.items.map(item => ({
              lineId: item.id,
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              edits: item.edits,
              allergens: item.allergens ?? [],
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              station: item.station,
              kitchenStartedAt: asIso(item.kitchenStartedAt),
              kitchenSentAt: asIso(item.kitchenSentAt),
              barStartedAt: asIso(item.barStartedAt),
              barSentAt: asIso(item.barSentAt),
              deliveredAt: asIso(item.deliveredAt),
              voidedAt: asIso(item.voidedAt),
              voidReason: item.voidReason,
              compedAt: asIso(item.compedAt),
              compReason: item.compReason,
              refireOfLineId: item.refireOfLineId,
            })),
          })),
          staffMessages: staffMessages.map(message => ({
            id: message.id,
            tableId: message.tableId,
            target: message.target,
            message: message.message,
            createdAt: message.createdAt.toISOString(),
          })),
          reprints: reprints.map(reprint => ({
            id: reprint.id,
            tableNumber: reprint.tableNumber,
            createdAt: reprint.createdAt.toISOString(),
          })),
          payments: payments.map(payment => ({
            id: payment.id,
            tableId: payment.tableId,
            amount: payment.amount,
            method: payment.method,
            status: payment.status,
            note: payment.note ?? undefined,
            createdAt: payment.createdAt.toISOString(),
          })),
          printJobs: printJobs.map(job => ({
            id: job.id,
            tableNumber: job.tableNumber,
            station: job.station,
            status: job.status,
            attempts: job.attempts,
            reason: job.reason,
            note: job.note ?? null,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
          })),
          auditTrail: auditTrail.map(event => ({
            id: event.id,
            createdAt: event.createdAt.toISOString(),
            actorRole: event.actorRole,
            actorId: event.actorId,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            before: event.before ?? undefined,
            after: event.after ?? undefined,
            note: event.note ?? undefined,
          })),
          idempotencyRecords: Object.fromEntries(
            idempotencyRecords.map(entry => [
              entry.key,
              {
                key: entry.key,
                createdAt: entry.createdAt.toISOString(),
                response:
                  entry.responseJson as Record<string, unknown>,
              },
            ])
          ),
        }

        importRuntimeStateSnapshot(snapshot)
        hydratedAt = Date.now()
        return
      }

      const record = await prisma.history.findUnique({
        where: { id: RUNTIME_HISTORY_ID },
      })
      if (record?.data) {
        importRuntimeStateSnapshot(record.data)
      }
      hydratedAt = Date.now()
    } catch {
      markPersistenceFailure()
    } finally {
      hydrating = null
    }
  })()

  await hydrating
}

export async function persistRuntimeStateToDb() {
  if (!canAttemptPersistence()) return

  try {
    const snapshot =
      exportRuntimeStateSnapshot() as unknown as RuntimeSnapshot
    const snapshotJson = snapshot as unknown as Prisma.InputJsonValue
    const relational = toRelationalRuntimeSnapshot(snapshot)

    await prisma.$transaction(async tx => {
      await tx.history.upsert({
        where: { id: RUNTIME_HISTORY_ID },
        update: { data: snapshotJson },
        create: {
          id: RUNTIME_HISTORY_ID,
          data: snapshotJson,
        },
      })

      await tx.runtimeMeta.upsert({
        where: { id: RUNTIME_META_ID },
        update: {
          menu: relational.menu as Prisma.InputJsonValue,
          flags: relational.flags as Prisma.InputJsonValue,
        },
        create: {
          id: RUNTIME_META_ID,
          menu: relational.menu as Prisma.InputJsonValue,
          flags: relational.flags as Prisma.InputJsonValue,
        },
      })

      await tx.runtimeOrderLineState.deleteMany()
      await tx.runtimeOrderState.deleteMany()
      await tx.runtimeTagState.deleteMany()
      await tx.runtimeSessionState.deleteMany()
      await tx.runtimeStaffMessageState.deleteMany()
      await tx.runtimeReprintState.deleteMany()
      await tx.runtimePaymentState.deleteMany()
      await tx.runtimePrintJobState.deleteMany()
      await tx.runtimeAuditState.deleteMany()
      await tx.runtimeIdempotencyState.deleteMany()
      await tx.runtimeTableState.deleteMany()

      if (relational.tables.length > 0) {
        await tx.runtimeTableState.createMany({
          data: relational.tables.map(table => ({
            id: String(table.id),
            number: Number(table.number),
            locked: Boolean(table.locked),
            stale: Boolean(table.stale),
            closeStatus: String(table.closeStatus) as never,
            billStatus: String(table.billStatus ?? "OPEN") as never,
            splitCount: Number(table.splitCount ?? 1),
            openedAt: asDate(table.openedAt),
            contributionWindowEndsAt: asDate(
              table.contributionWindowEndsAt
            ),
          })),
        })
      }

      if (relational.tags.length > 0) {
        await tx.runtimeTagState.createMany({
          data: relational.tags.map(tag => ({
            id: String(tag.id),
            active: Boolean(tag.active),
            tableId:
              typeof tag.tableId === "string" ? tag.tableId : null,
            lastSeenAt: asDate(tag.lastSeenAt),
            createdAt: asDate(tag.createdAt),
          })),
        })
      }

      if (relational.sessions.length > 0) {
        await tx.runtimeSessionState.createMany({
          data: relational.sessions.map(session => ({
            id: String(session.id),
            origin: String(session.origin) as never,
            tagId:
              typeof session.tagId === "string"
                ? session.tagId
                : null,
            tableId:
              typeof session.tableId === "string"
                ? session.tableId
                : null,
            lastActivityAt: asDate(session.lastActivityAt),
            createdAt: asDate(session.createdAt),
          })),
        })
      }

      if (relational.orders.length > 0) {
        const orderRows: Prisma.RuntimeOrderStateCreateManyInput[] = []
        const lineRows: Prisma.RuntimeOrderLineStateCreateManyInput[] = []

        for (const order of relational.orders) {
          orderRows.push({
            id: String(order.id),
            sessionId: String(order.sessionId),
            tagId: String(order.tagId),
            tableId: String(order.tableId),
            tableNumber: Number(order.tableNumber),
            submittedAt: asDate(order.submittedAt),
          })

          const items = Array.isArray(order.items) ? order.items : []
          for (const item of items) {
            lineRows.push({
              id: String(item.lineId),
              orderId: String(order.id),
              itemId: String(item.itemId),
              name: String(item.name),
              quantity: Number(item.quantity),
              edits:
                item.edits === undefined || item.edits === null
                  ? undefined
                  : (item.edits as Prisma.InputJsonValue),
              allergens:
                (item.allergens ?? []) as Prisma.InputJsonValue,
              unitPrice: Number(item.unitPrice),
              vatRate: Number(item.vatRate),
              station: String(item.station) as never,
              kitchenStartedAt:
                item.kitchenStartedAt ? asDate(item.kitchenStartedAt) : null,
              kitchenSentAt:
                item.kitchenSentAt ? asDate(item.kitchenSentAt) : null,
              barStartedAt:
                item.barStartedAt ? asDate(item.barStartedAt) : null,
              barSentAt:
                item.barSentAt ? asDate(item.barSentAt) : null,
              deliveredAt:
                item.deliveredAt ? asDate(item.deliveredAt) : null,
              voidedAt: item.voidedAt ? asDate(item.voidedAt) : null,
              voidReason:
                typeof item.voidReason === "string"
                  ? item.voidReason
                  : null,
              compedAt: item.compedAt ? asDate(item.compedAt) : null,
              compReason:
                typeof item.compReason === "string"
                  ? item.compReason
                  : null,
              refireOfLineId:
                typeof item.refireOfLineId === "string"
                  ? item.refireOfLineId
                  : null,
            })
          }
        }

        if (orderRows.length > 0) {
          await tx.runtimeOrderState.createMany({ data: orderRows })
        }
        if (lineRows.length > 0) {
          await tx.runtimeOrderLineState.createMany({ data: lineRows })
        }
      }

      if (relational.staffMessages.length > 0) {
        await tx.runtimeStaffMessageState.createMany({
          data: relational.staffMessages.map(message => ({
            id: String(message.id),
            tableId: String(message.tableId),
            target: String(message.target) as never,
            message: String(message.message),
            createdAt: asDate(message.createdAt),
          })),
        })
      }

      if (relational.reprints.length > 0) {
        await tx.runtimeReprintState.createMany({
          data: relational.reprints.map(reprint => ({
            id: String(reprint.id),
            tableNumber: Number(reprint.tableNumber),
            createdAt: asDate(reprint.createdAt),
          })),
        })
      }

      if (relational.payments.length > 0) {
        await tx.runtimePaymentState.createMany({
          data: relational.payments.map(payment => ({
            id: String(payment.id),
            tableId: String(payment.tableId),
            amount: Number(payment.amount),
            method: String(payment.method ?? "manual"),
            status: String(payment.status ?? "PAID") as never,
            note:
              typeof payment.note === "string"
                ? payment.note
                : null,
            createdAt: asDate(payment.createdAt),
          })),
        })
      }

      if (relational.printJobs.length > 0) {
        await tx.runtimePrintJobState.createMany({
          data: relational.printJobs.map(job => ({
            id: String(job.id),
            tableNumber: Number(job.tableNumber),
            station: String(job.station) as never,
            status: String(job.status) as never,
            attempts: Number(job.attempts ?? 1),
            reason: String(job.reason ?? "MANUAL_REPRINT"),
            note:
              typeof job.note === "string" ? job.note : null,
            createdAt: asDate(job.createdAt),
            updatedAt: asDate(job.updatedAt),
          })),
        })
      }

      if (relational.auditTrail.length > 0) {
        await tx.runtimeAuditState.createMany({
          data: relational.auditTrail.map(event => ({
            id: String(event.id),
            createdAt: asDate(event.createdAt),
            actorRole: String(event.actorRole),
            actorId: String(event.actorId),
            action: String(event.action),
            targetType: String(event.targetType),
            targetId: String(event.targetId),
            before:
              event.before === undefined || event.before === null
                ? undefined
                : (event.before as Prisma.InputJsonValue),
            after:
              event.after === undefined || event.after === null
                ? undefined
                : (event.after as Prisma.InputJsonValue),
            note:
              typeof event.note === "string" ? event.note : null,
          })),
        })
      }

      const idempotencyRows = Object.values(
        relational.idempotencyRecords
      )
      if (idempotencyRows.length > 0) {
        await tx.runtimeIdempotencyState.createMany({
          data: idempotencyRows.map(record => ({
            key: String(record.key),
            createdAt: asDate(record.createdAt),
            responseJson:
              (record.response ?? {}) as Prisma.InputJsonValue,
          })),
        })
      }
    })
  } catch {
    markPersistenceFailure()
  }
}
