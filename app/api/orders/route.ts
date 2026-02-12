import { NextResponse } from "next/server"
import { OrderStatus, Prisma, Station } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import {
  MEMBER_INACTIVE_MS,
  SESSION_IDLE_TIMEOUT_MS,
  UNCONFIRMED_ITEM_EXPIRY_MS,
} from "@/lib/constants"
import {
  getEditClientKey,
  getEditHardActivityAt,
  isEditConfirmed,
  stripInternalEditMeta,
  withEditClientKey,
} from "@/lib/itemEdits"
import {
  getTableGroupByAssignmentId,
  getTableGroupForTag,
  isTableGroupClosed,
  isTableGroupLocked,
} from "@/lib/tableGroups"

type SubmitItem = {
  itemId?: string
  menuItemId?: string
  name?: string
  quantity?: number
  edits?: unknown
  allergens?: string[]
  unitPrice?: number
  vatRate?: number
  station?: "KITCHEN" | "BAR" | "kitchen" | "bar"
}

function toStation(value: string | undefined | null): Station {
  return String(value ?? "").toUpperCase() === "BAR"
    ? "BAR"
    : "KITCHEN"
}

function asJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return [] as unknown as Prisma.InputJsonValue
  }
  return value as Prisma.InputJsonValue
}

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function editsToInputJson(
  edits: unknown,
  clientKey?: string | null
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined {
  const editsWithMeta = withEditClientKey(edits, clientKey)
  if (editsWithMeta === undefined) return undefined
  if (editsWithMeta === null) return Prisma.JsonNull
  return editsWithMeta as Prisma.InputJsonValue
}

async function resolveCustomerSession({
  sessionId,
  tagId,
}: {
  sessionId?: string | null
  tagId?: string | null
}) {
  const normalizedSessionId =
    typeof sessionId === "string" &&
    sessionId.length > 0 &&
    !sessionId.startsWith("local:")
      ? sessionId
      : null
  const normalizedTagId =
    typeof tagId === "string" && tagId.length > 0
      ? tagId
      : null

  let session = normalizedSessionId
    ? await prisma.session.findUnique({
        where: { id: normalizedSessionId },
      })
    : null

  if (!session && normalizedTagId) {
    session = await prisma.session.findFirst({
      where: {
        tagId: normalizedTagId,
        status: "ACTIVE",
      },
      orderBy: { lastActivityAt: "desc" },
    })
  }

  if (!session) return null
  if (normalizedTagId && session.tagId !== normalizedTagId) {
    return null
  }

  return session
}

async function resolveSessionTableGroup(input: {
  tableId?: string | null
  tagId?: string | null
}) {
  if (input.tableId) {
    const byTable = await getTableGroupByAssignmentId(input.tableId)
    if (byTable) return byTable
  }
  if (input.tagId) {
    const byTag = await getTableGroupForTag(input.tagId)
    if (byTag) return byTag
  }
  return null
}

async function syncOrderStatus(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { status: true },
  })

  const hasOpen = items.some(i => i.status !== "COMPLETED")
  const nextStatus: OrderStatus = hasOpen ? "IN_PROGRESS" : "COMPLETED"

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      completedAt: hasOpen ? null : new Date(),
    },
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const station = searchParams.get("station")
  const tableNumberRaw = searchParams.get("tableNumber")
  const sessionIdRaw = searchParams.get("sessionId")
  const tagIdRaw = searchParams.get("tagId")
  const clientKeyRaw = searchParams.get("clientKey")
  const requesterClientKey = normalizeClientKey(clientKeyRaw)

  if (sessionIdRaw || tagIdRaw) {
    const session = await resolveCustomerSession({
      sessionId: sessionIdRaw,
      tagId: tagIdRaw,
    })
    if (!session) {
      return NextResponse.json({ items: [] })
    }

    const tableGroup = await resolveSessionTableGroup({
      tableId: session.tableId,
      tagId: session.tagId,
    })
    const groupedTableIds =
      tableGroup?.assignments.map(assignment => assignment.id) ?? []
    const orderWhere: Prisma.OrderWhereInput =
      groupedTableIds.length > 0
        ? {
            tableId: { in: groupedTableIds },
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          }
        : session.tableId
        ? {
            tableId: session.tableId,
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          }
        : {
            sessionId: session.id,
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        items: {
          where: {
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const items = orders.flatMap(order =>
      order.items.map(i => {
        const ownerClientKey = getEditClientKey(i.edits)
        const isMine = Boolean(
          requesterClientKey &&
            ownerClientKey === requesterClientKey
        )

        return {
          orderId: order.id,
          orderItemId: i.id,
          status: i.status.toLowerCase(),
          submittedAt: order.createdAt.toISOString(),
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          edits: stripInternalEditMeta(i.edits),
          allergens: i.allergens,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          station: i.station,
          isMine,
          ownerClientKey,
        }
      })
    )

    return NextResponse.json({
      sessionId: session.id,
      tableId: session.tableId,
      tableNumber: tableGroup?.tableNo ?? null,
      firstSubmittedAt: orders[0]?.createdAt.toISOString() ?? null,
      items,
    })
  }

  if (station) {
    try {
      requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const targetStation = toStation(station)
    const orders = await prisma.order.findMany({
      where: {
        targetStation,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      include: {
        table: true,
        items: {
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const rows = orders.flatMap(order =>
      order.items
        .filter(i => i.station === targetStation)
        .map(i => ({
          orderId: order.id,
          orderItemId: i.id,
          tableNumber: order.table.tableNo,
          name: i.name,
          quantity: i.quantity,
          edits: stripInternalEditMeta(i.edits),
          submittedAt: order.createdAt.toISOString(),
        }))
    )

    return NextResponse.json(rows)
  }

  if (tableNumberRaw) {
    try {
      requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const tableNumber = Number(tableNumberRaw)
    if (!Number.isFinite(tableNumber)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
    }

    const assignments = await prisma.tableAssignment.findMany({
      where: { tableNo: tableNumber },
      select: { id: true },
    })
    if (assignments.length === 0) {
      return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: { tableId: { in: assignments.map(a => a.id) } },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const groups = orders.map(order => ({
      orderId: order.id,
      status: order.status.toLowerCase(),
      submittedAt: order.createdAt.toISOString(),
      items: order.items.map(i => ({
        orderItemId: i.id,
        status: i.status.toLowerCase(),
        name: i.name,
        quantity: i.quantity,
        edits: stripInternalEditMeta(i.edits),
        submittedAt: order.createdAt.toISOString(),
      })),
    }))

    return NextResponse.json({
      tableNumber,
      firstSubmittedAt: groups[0]?.submittedAt ?? new Date().toISOString(),
      initialOrders: groups.slice(0, 1),
      addonOrders: groups.slice(1),
    })
  }

  return NextResponse.json([])
}

export async function POST(req: Request) {
  try {
    const { sessionId, tagId, items, clientKey } =
      await req.json()
    const requesterClientKey = normalizeClientKey(clientKey)

    const resolvedSessionId =
      typeof sessionId === "string" && sessionId.length > 0
        ? sessionId
        : null

    if (!resolvedSessionId && !tagId) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
    }

    let session = resolvedSessionId
      ? await prisma.session.findUnique({
          where: { id: resolvedSessionId },
          include: {
            tag: { include: { assignment: true } },
            cart: {
              include: {
                items: true,
              },
            },
          },
        })
      : null

    let tag = tagId
      ? await prisma.nfcTag.findUnique({
          where: { id: tagId },
          include: { assignment: true },
        })
      : session?.tag ?? null

    if (!tag && tagId) {
      return NextResponse.json(
        { error: "TAG_NOT_REGISTERED" },
        { status: 404 }
      )
    }

    if (!session && resolvedSessionId) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 })
    }

    if (!session && tag) {
      const reused = await prisma.session.findFirst({
        where: {
          tagId: tag.id,
          status: "ACTIVE",
        },
        include: {
          tag: { include: { assignment: true } },
          cart: { include: { items: true } },
        },
        orderBy: { lastActivityAt: "desc" },
      })

      const reusedIsFresh =
        reused &&
        Date.now() - reused.lastActivityAt.getTime() <=
          SESSION_IDLE_TIMEOUT_MS

      if (reused && reusedIsFresh) {
        session = reused
      } else {
        if (reused && !reusedIsFresh) {
          await prisma.session.update({
            where: { id: reused.id },
            data: {
              status: "CLOSED",
              closedAt: new Date(),
            },
          })
        }

        const tagTableGroup = await getTableGroupForTag(tag.id)
        const masterTableId = tagTableGroup?.master.id ?? null

        session = await prisma.session.create({
          data: {
            tagId: tag.id,
            tableId: masterTableId,
            status: "ACTIVE",
            openedAt: new Date(),
            lastActivityAt: new Date(),
          },
          include: {
            tag: { include: { assignment: true } },
            cart: { include: { items: true } },
          },
        })

        await appendSystemEvent(
          "session_created",
          {
            sessionId: session.id,
            tagId: tag.id,
            source: "orders_post",
          },
          {
            req,
            sessionId: session.id,
            tableId: masterTableId,
          }
        )

        if (!session.cart) {
          await prisma.sessionCart.create({
            data: { sessionId: session.id },
          })
          session = await prisma.session.findUnique({
            where: { id: session.id },
            include: {
              tag: { include: { assignment: true } },
              cart: { include: { items: true } },
            },
          })
        }
      }
    }

    if (!session) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 })
    }

    const tableGroup = await resolveSessionTableGroup({
      tableId: session.tableId,
      tagId: session.tagId,
    })
    const table = tableGroup?.master ?? null

    if (!table) {
      return NextResponse.json({ error: "TABLE_NOT_ASSIGNED" }, { status: 400 })
    }

    if (session.tableId !== table.id) {
      await prisma.session.update({
        where: { id: session.id },
        data: { tableId: table.id },
      })
      session = {
        ...session,
        tableId: table.id,
      }
    }

    if (tableGroup && isTableGroupClosed(tableGroup)) {
      return NextResponse.json({ error: "TABLE_CLOSED" }, { status: 409 })
    }
    if (tableGroup && isTableGroupLocked(tableGroup)) {
      return NextResponse.json({ error: "TABLE_LOCKED" }, { status: 423 })
    }

    const stale =
      Date.now() - session.lastActivityAt.getTime() >
      SESSION_IDLE_TIMEOUT_MS
    if (stale || session.status !== "ACTIVE") {
      if (stale && session.status === "ACTIVE") {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
          },
        })
        await appendSystemEvent(
          "session_closed_stale",
          { sessionId: session.id },
          { req, sessionId: session.id, tableId: session.tableId }
        )
      }
      return NextResponse.json({ error: "SESSION_STALE" }, { status: 410 })
    }

    const memberConfirmationByClientKey = new Map<
      string,
      {
        confirmed: boolean
        hardActivityAt: string
        inactive: boolean
        expired: boolean
      }
    >()
    const sessionCartItems = session?.cart?.items ?? []
    let effectiveSessionCartItems = sessionCartItems

    if (sessionCartItems.length > 0) {
      const nowMs = Date.now()
      for (const cartItem of sessionCartItems) {
        const ownerClientKey = getEditClientKey(cartItem.edits)
        if (!ownerClientKey) continue

        const confirmed = isEditConfirmed(cartItem.edits)
        const hardActivityAt =
          getEditHardActivityAt(cartItem.edits) ??
          cartItem.updatedAt.toISOString()
        const existing =
          memberConfirmationByClientKey.get(ownerClientKey)
        if (!existing) {
          memberConfirmationByClientKey.set(ownerClientKey, {
            confirmed,
            hardActivityAt,
            inactive: false,
            expired: false,
          })
          continue
        }

        const nextHardActivityAt =
          new Date(hardActivityAt).getTime() >
          new Date(existing.hardActivityAt).getTime()
            ? hardActivityAt
            : existing.hardActivityAt

        memberConfirmationByClientKey.set(ownerClientKey, {
          confirmed: existing.confirmed && confirmed,
          hardActivityAt: nextHardActivityAt,
          inactive: false,
          expired: false,
        })
      }

      const activeMembers: Array<{ confirmed: boolean }> = []
      for (const [clientKey, member] of memberConfirmationByClientKey.entries()) {
        const idleForMs =
          nowMs - new Date(member.hardActivityAt).getTime()
        const inactive = idleForMs >= MEMBER_INACTIVE_MS
        const expired =
          !member.confirmed &&
          idleForMs >= UNCONFIRMED_ITEM_EXPIRY_MS
        memberConfirmationByClientKey.set(clientKey, {
          ...member,
          inactive,
          expired,
        })
        if (!inactive && !expired) {
          activeMembers.push({ confirmed: member.confirmed })
        }
      }

      const expiredUnconfirmedItemIds = sessionCartItems
        .filter(cartItem => {
          const ownerClientKey = getEditClientKey(cartItem.edits)
          if (!ownerClientKey) return false
          const member =
            memberConfirmationByClientKey.get(ownerClientKey)
          if (!member) return false
          return member.expired && !member.confirmed
        })
        .map(item => item.id)

      if (expiredUnconfirmedItemIds.length > 0 && session.cart) {
        await prisma.cartItem.deleteMany({
          where: {
            cartId: session.cart.id,
            id: { in: expiredUnconfirmedItemIds },
          },
        })
        const expiredSet = new Set(expiredUnconfirmedItemIds)
        effectiveSessionCartItems = sessionCartItems.filter(
          item => !expiredSet.has(item.id)
        )

        await appendSystemEvent(
          "member_items_expired",
          {
            sessionId: session.id,
            itemCount: expiredUnconfirmedItemIds.length,
          },
          {
            req,
            sessionId: session.id,
            tableId: table.id,
          }
        )
      }

      const unconfirmedMemberCount = activeMembers.filter(
        member => !member.confirmed
      ).length

      if (unconfirmedMemberCount > 0) {
        return NextResponse.json(
          {
            error: "MEMBER_CONFIRMATION_REQUIRED",
            unconfirmedMemberCount,
          },
          { status: 409 }
        )
      }
    }

    const sendableSessionCartItems = effectiveSessionCartItems.filter(item => {
      const ownerClientKey = getEditClientKey(item.edits)
      if (!ownerClientKey) return true

      const member =
        memberConfirmationByClientKey.get(ownerClientKey)
      if (!member) return false
      return member.confirmed
    })
    const skippedUnconfirmedInactiveItemCount =
      effectiveSessionCartItems.filter(item => {
        const ownerClientKey = getEditClientKey(item.edits)
        if (!ownerClientKey) return false
        const member =
          memberConfirmationByClientKey.get(ownerClientKey)
        if (!member) return false
        return (member.inactive || member.expired) && !member.confirmed
      }).length

    const sentCartItemIds = sendableSessionCartItems.map(i => i.id)

    const submittedItems: SubmitItem[] =
      effectiveSessionCartItems.length > 0
        ? sendableSessionCartItems.map(i => ({
            itemId: i.id,
            menuItemId: i.menuItemId ?? undefined,
            name: i.name,
            quantity: i.quantity,
            edits: i.edits,
            allergens: Array.isArray(i.allergens)
              ? (i.allergens as string[])
              : [],
            unitPrice: i.unitPrice,
            vatRate: i.vatRate,
            station: i.station,
          }))
        : Array.isArray(items) && items.length > 0
        ? items
        : []

    if (submittedItems.length === 0) {
      if (sessionCartItems.length > 0) {
        return NextResponse.json({
          orderIds: [],
          ticketId: null,
          skippedUnconfirmedInactiveItemCount,
        })
      }
      return NextResponse.json({ error: "EMPTY_ORDER" }, { status: 400 })
    }

    const grouped = new Map<Station, SubmitItem[]>()
    for (const item of submittedItems) {
      const qty = Number(item.quantity ?? 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        continue
      }
      const stationKey = toStation(item.station)
      const next = grouped.get(stationKey) ?? []
      next.push({
        ...item,
        quantity: qty,
      })
      grouped.set(stationKey, next)
    }

    if (grouped.size === 0) {
      return NextResponse.json(
        { error: "EMPTY_ORDER" },
        { status: 400 }
      )
    }

    const referencedMenuIds = Array.from(
      new Set(
        submittedItems
          .map(item => item.menuItemId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    )
    const validMenuIds = new Set<string>()
    if (referencedMenuIds.length > 0) {
      const existingMenuItems = await prisma.menuItem.findMany({
        where: {
          id: {
            in: referencedMenuIds,
          },
        },
        select: { id: true },
      })
      for (const menuItem of existingMenuItems) {
        validMenuIds.add(menuItem.id)
      }
    }

    const createdOrderIds: string[] = []

    for (const [stationKey, stationItems] of grouped.entries()) {
      const order = await prisma.order.create({
        data: {
          sessionId: session.id,
          tableId: table.id,
          targetStation: stationKey,
          status: "PENDING",
          items: {
            create: stationItems.map(item => ({
              menuItemId:
                typeof item.menuItemId === "string" &&
                validMenuIds.has(item.menuItemId)
                  ? item.menuItemId
                  : null,
              name: String(item.name ?? "Item"),
              quantity: Number(item.quantity ?? 1),
              unitPrice: Number(item.unitPrice ?? 0),
              vatRate: Number(item.vatRate ?? 0),
              allergens: asJson(
                Array.isArray(item.allergens) ? item.allergens : []
              ),
              edits: editsToInputJson(
                item.edits,
                getEditClientKey(item.edits) ??
                  requesterClientKey
              ),
              station: stationKey,
              status: "PENDING",
            })),
          },
        },
      })

      createdOrderIds.push(order.id)
      await appendSystemEvent(
        "order_submitted",
        {
          orderId: order.id,
          station: stationKey,
          itemCount: stationItems.length,
        },
        {
          req,
          sessionId: session.id,
          tableId: table.id,
          orderId: order.id,
        }
      )
    }

    if (session.cart && sentCartItemIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: session.cart.id,
          id: { in: sentCartItemIds },
        },
      })
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({
      orderIds: createdOrderIds,
      ticketId: createdOrderIds[0] ?? null,
      skippedUnconfirmedInactiveItemCount,
    })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error)
    console.error("orders_post_failed", {
      detail,
    })
    return NextResponse.json(
      {
        error: "ORDER_SUBMIT_FAILED",
        detail:
          process.env.NODE_ENV === "production"
            ? undefined
            : detail,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const body = await req.json()

  const hasQuantityUpdate =
    typeof body?.quantity === "number"
  const hasEditsUpdate = Object.prototype.hasOwnProperty.call(
    body ?? {},
    "edits"
  )
  const itemUpdateRequested =
    typeof body?.orderItemId === "string" &&
    (hasQuantityUpdate || hasEditsUpdate)

  if (itemUpdateRequested) {
    const orderItemId = String(body.orderItemId ?? "").trim()
    const quantity = Number(body?.quantity ?? 0)
    const requesterClientKey = normalizeClientKey(
      body?.clientKey
    )
    if (
      !orderItemId ||
      (hasQuantityUpdate &&
        (!Number.isInteger(quantity) || quantity < 0))
    ) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
    }

    const customerScopedSession = await resolveCustomerSession({
      sessionId:
        typeof body?.sessionId === "string"
          ? body.sessionId
          : null,
      tagId:
        typeof body?.tagId === "string" ? body.tagId : null,
    })

    if (!customerScopedSession) {
      try {
        requireStaff(req)
      } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
      }
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    })
    if (!orderItem) {
      return NextResponse.json(
        { error: "ORDER_ITEM_NOT_FOUND" },
        { status: 404 }
      )
    }

    if (
      customerScopedSession &&
      orderItem.order.sessionId !== customerScopedSession.id
    ) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (customerScopedSession) {
      const ownerClientKey = getEditClientKey(orderItem.edits)
      if (
        ownerClientKey &&
        ownerClientKey !== requesterClientKey
      ) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
      }

      return NextResponse.json(
        { error: "ORDER_ALREADY_SENT" },
        { status: 409 }
      )
    }

    if (
      orderItem.status === "COMPLETED" ||
      orderItem.order.status === "COMPLETED"
    ) {
      return NextResponse.json(
        { error: "ORDER_ITEM_LOCKED" },
        { status: 409 }
      )
    }

    if (hasQuantityUpdate && quantity === 0) {
      await prisma.orderItem.delete({
        where: { id: orderItem.id },
      })

      const remainingOpenItems =
        await prisma.orderItem.count({
          where: {
            orderId: orderItem.orderId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        })

      let orderStatus: OrderStatus = orderItem.order.status
      if (remainingOpenItems === 0) {
        const completedOrder = await prisma.order.update({
          where: { id: orderItem.orderId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })
        orderStatus = completedOrder.status
        await appendSystemEvent(
          "order_completed",
          { orderId: completedOrder.id },
          {
            req,
            orderId: completedOrder.id,
            tableId: completedOrder.tableId,
          }
        )
      }

      await prisma.session.update({
        where: { id: orderItem.order.sessionId },
        data: { lastActivityAt: new Date() },
      })

      await appendSystemEvent(
        "order_item_removed",
        {
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          name: orderItem.name,
        },
        {
          req,
          orderId: orderItem.orderId,
          tableId: orderItem.order.tableId,
          sessionId: orderItem.order.sessionId,
        }
      )

      return NextResponse.json({
        removed: true,
        orderId: orderItem.orderId,
        orderStatus: orderStatus.toLowerCase(),
      })
    }

    const nextData: Prisma.OrderItemUpdateInput = {}
    if (hasQuantityUpdate) {
      nextData.quantity = quantity
    }
    if (hasEditsUpdate) {
      const ownerClientKey = getEditClientKey(orderItem.edits)
      const keyForWrite = ownerClientKey ?? requesterClientKey
      const nextEdits = editsToInputJson(
        body?.edits,
        keyForWrite
      )
      if (nextEdits !== undefined) {
        nextData.edits = nextEdits
      }
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: nextData,
    })

    await prisma.session.update({
      where: { id: orderItem.order.sessionId },
      data: { lastActivityAt: new Date() },
    })

    if (hasQuantityUpdate) {
      await appendSystemEvent(
        "order_item_quantity_updated",
        {
          orderId: orderItem.orderId,
          orderItemId: updatedItem.id,
          quantity: updatedItem.quantity,
        },
        {
          req,
          orderId: orderItem.orderId,
          tableId: orderItem.order.tableId,
          sessionId: orderItem.order.sessionId,
        }
      )
    }
    if (hasEditsUpdate) {
      await appendSystemEvent(
        "order_item_edited",
        {
          orderId: orderItem.orderId,
          orderItemId: updatedItem.id,
        },
        {
          req,
          orderId: orderItem.orderId,
          tableId: orderItem.order.tableId,
          sessionId: orderItem.order.sessionId,
        }
      )
    }

    return NextResponse.json({
      id: updatedItem.id,
      quantity: updatedItem.quantity,
      orderId: orderItem.orderId,
      edits: stripInternalEditMeta(updatedItem.edits),
    })
  }

  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (typeof body?.orderItemId === "string") {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: body.orderItemId },
      include: {
        order: true,
      },
    })
    if (!orderItem) {
      return NextResponse.json({ error: "ORDER_ITEM_NOT_FOUND" }, { status: 404 })
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })

    const updatedOrder = await syncOrderStatus(orderItem.orderId)
    await appendSystemEvent(
      "order_item_completed",
      {
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
      },
      {
        req,
        orderId: orderItem.orderId,
        tableId: orderItem.order.tableId,
      }
    )

    if (updatedOrder.status === "COMPLETED") {
      await appendSystemEvent(
        "order_completed",
        { orderId: updatedOrder.id },
        {
          req,
          orderId: updatedOrder.id,
          tableId: updatedOrder.tableId,
        }
      )
    }

    return NextResponse.json({
      completed: 1,
      orderId: updatedOrder.id,
      orderStatus: updatedOrder.status.toLowerCase(),
      item: {
        ...updatedItem,
        edits: stripInternalEditMeta(updatedItem.edits),
      },
    })
  }

  const tableNumber = Number(body?.tableNumber)
  if (!Number.isFinite(tableNumber)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }
  const station = toStation(
    typeof body?.station === "string" ? body.station : undefined
  )

  const assignments = await prisma.tableAssignment.findMany({
    where: { tableNo: tableNumber },
    select: { id: true },
  })
  if (assignments.length === 0) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }

  const openItems = await prisma.orderItem.findMany({
    where: {
      order: {
        tableId: { in: assignments.map(a => a.id) },
      },
      station,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      order: true,
    },
    orderBy: { createdAt: "asc" },
  })

  if (openItems.length === 0) {
    return NextResponse.json({ completed: 0 })
  }

  const itemIds = openItems.map(i => i.id)

  await prisma.orderItem.updateMany({
    where: { id: { in: itemIds } },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  })

  const uniqueOrderIds = Array.from(
    new Set(openItems.map(i => i.orderId))
  )
  for (const orderId of uniqueOrderIds) {
    const order = await syncOrderStatus(orderId)
    if (order.status === "COMPLETED") {
      await appendSystemEvent(
        "order_completed",
        { orderId: order.id },
        {
          req,
          orderId: order.id,
          tableId: order.tableId,
        }
      )
    }
  }

  await appendSystemEvent(
    "table_station_completed",
    {
      tableNumber,
      station,
      completedItems: itemIds.length,
    },
    {
      req,
      tableId: assignments[0].id,
    }
  )

  return NextResponse.json({ completed: itemIds.length })
}

export async function PUT(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { tableNumber } = await req.json()
  if (typeof tableNumber !== "number") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  await appendSystemEvent(
    "ticket_reprint_requested",
    { tableNumber },
    { req }
  )

  return NextResponse.json({ reprinted: true })
}
