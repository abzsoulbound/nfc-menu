import { NextResponse } from "next/server"
import { OrderStatus, Prisma, Station } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import { findTagByToken } from "@/lib/db/tags"
import { logWithRequest } from "@/lib/logger"
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
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

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

function normalizeClientRequestId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 128)
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
  restaurantId,
}: {
  sessionId?: string | null
  tagId?: string | null
  restaurantId: string
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
  if (session && session.restaurantId !== restaurantId) {
    session = null
  }

  if (!session && normalizedTagId) {
    session = await prisma.session.findFirst({
      where: {
        restaurantId,
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
  restaurantId: string
}) {
  if (input.tableId) {
    const byTable = await getTableGroupByAssignmentId(
      input.tableId,
      input.restaurantId
    )
    if (byTable) return byTable
  }
  if (input.tagId) {
    const byTag = await getTableGroupForTag(
      input.tagId,
      input.restaurantId
    )
    if (byTag) return byTag
  }
  return null
}

async function syncOrderStatus(orderId: string, restaurantId: string) {
  const ticketItems = await prisma.ticketItem.findMany({
    where: {
      restaurantId,
      ticket: {
        orderId,
      },
    },
    select: { status: true },
  })
  const fallbackOrderItems = await prisma.orderItem.findMany({
    where: {
      orderId,
      restaurantId,
    },
    select: { status: true },
  })

  const statusRows =
    ticketItems.length > 0 ? ticketItems : fallbackOrderItems
  const hasOpen = statusRows.some(i => i.status !== "COMPLETED")
  const nextStatus: OrderStatus = hasOpen ? "IN_PROGRESS" : "COMPLETED"

  await prisma.order.updateMany({
    where: {
      id: orderId,
      restaurantId,
    },
    data: {
      status: nextStatus,
      completedAt: hasOpen ? null : new Date(),
    },
  })

  return prisma.order.findUnique({
    where: { id: orderId },
  })
}

async function syncTicketStatus(ticketId: string, restaurantId: string) {
  const items = await prisma.ticketItem.findMany({
    where: {
      restaurantId,
      ticketId,
    },
    select: {
      status: true,
    },
  })

  const hasOpen = items.some(item => item.status !== "COMPLETED")
  const nextStatus: OrderStatus = hasOpen ? "IN_PROGRESS" : "COMPLETED"

  await prisma.kitchenTicket.updateMany({
    where: {
      id: ticketId,
      restaurantId,
    },
    data: {
      status: nextStatus,
      readyAt: hasOpen ? null : new Date(),
      completedAt: hasOpen ? null : new Date(),
    },
  })
}

export async function GET(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
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
      restaurantId: restaurant.id,
    })
    if (!session) {
      return NextResponse.json({ items: [] })
    }

    const tableGroup = await resolveSessionTableGroup({
      tableId: session.tableId,
      tagId: session.tagId,
      restaurantId: restaurant.id,
    })
    const groupedTableIds =
      tableGroup?.assignments.map(assignment => assignment.id) ?? []
    const orderWhere: Prisma.OrderWhereInput =
      groupedTableIds.length > 0
        ? {
            restaurantId: restaurant.id,
            tableId: { in: groupedTableIds },
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          }
        : session.tableId
        ? {
            restaurantId: restaurant.id,
            tableId: session.tableId,
            status: {
              in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
            },
          }
        : {
            restaurantId: restaurant.id,
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
      await requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const targetStation = toStation(station)
    const tickets = await prisma.kitchenTicket.findMany({
      where: {
        restaurantId: restaurant.id,
        station: targetStation,
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

    const rows = tickets.flatMap(ticket =>
      ticket.items.map(item => ({
        orderId: ticket.orderId ?? ticket.id,
        orderItemId: item.orderItemId ?? item.id,
        tableNumber: ticket.table.tableNo,
        name: item.name,
        quantity: item.quantity,
        edits: null,
        submittedAt: ticket.createdAt.toISOString(),
      }))
    )

    return NextResponse.json(rows)
  }

  if (tableNumberRaw) {
    try {
      await requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const tableNumber = Number(tableNumberRaw)
    if (!Number.isFinite(tableNumber)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
    }

    const assignments = await prisma.tableAssignment.findMany({
      where: {
        restaurantId: restaurant.id,
        tableNo: tableNumber,
      },
      select: { id: true },
    })
    if (assignments.length === 0) {
      return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        tableId: { in: assignments.map(a => a.id) },
      },
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
    const restaurant = await resolveRestaurantFromRequest(req)
    const {
      sessionId,
      tagId,
      items,
      clientKey,
      clientRequestId: clientRequestIdFromBody,
    } =
      await req.json()
    const requesterClientKey = normalizeClientKey(clientKey)
    const clientRequestId = normalizeClientRequestId(
      clientRequestIdFromBody ??
        req.headers.get("x-idempotency-key")
    )

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
    if (session && session.restaurantId !== restaurant.id) {
      session = null
    }

    let tag = tagId
      ? await findTagByToken({
          restaurantId: restaurant.id,
          tagId,
        })
      : session?.tag ?? null
    if (tag && tag.restaurantId !== restaurant.id) {
      tag = null
    }

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
          restaurantId: restaurant.id,
          tagId: tag.tagId,
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

        const tagTableGroup = await getTableGroupForTag(
          tag.tagId,
          restaurant.id
        )
        const masterTableId = tagTableGroup?.master.id ?? null

        session = await prisma.session.create({
          data: {
            restaurantId: restaurant.id,
            nfcTagId: tag.id,
            tagId: tag.tagId,
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
            tagId: tag.tagId,
            source: "orders_post",
          },
          {
            req,
            restaurantId: restaurant.id,
            sessionId: session.id,
            tableId: masterTableId,
          }
        )

        if (!session.cart) {
          await prisma.sessionCart.create({
            data: {
              sessionId: session.id,
              restaurantId: restaurant.id,
            },
          })
          session = await prisma.session.findUnique({
            where: { id: session.id },
            include: {
              tag: { include: { assignment: true } },
              cart: { include: { items: true } },
            },
          })
          if (session && session.restaurantId !== restaurant.id) {
            session = null
          }
        }
      }
    }

    if (!session) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 })
    }

    const tableGroup = await resolveSessionTableGroup({
      tableId: session.tableId,
      tagId: session.tagId,
      restaurantId: restaurant.id,
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

    if (clientRequestId) {
      const duplicate = await prisma.order.findFirst({
        where: {
          restaurantId: restaurant.id,
          clientRequestId,
        },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json(
          {
            error: "DUPLICATE_REQUEST",
            orderIds: [duplicate.id],
            duplicate: true,
          },
          { status: 409 }
        )
      }
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
          {
            req,
            restaurantId: restaurant.id,
            sessionId: session.id,
            tableId: session.tableId,
          }
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
            restaurantId: restaurant.id,
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
            restaurantId: restaurant.id,
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
          restaurantId: restaurant.id,
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

    const flattenedItems = Array.from(grouped.entries()).flatMap(
      ([stationKey, stationItems]) =>
        stationItems.map(item => ({
          ...item,
          station: stationKey,
          quantity: Number(item.quantity ?? 1),
        }))
    )
    const primaryStation = flattenedItems[0]?.station ?? "KITCHEN"

    const createdOrder = await prisma.$transaction(async tx => {
      const order = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          sessionId: session.id,
          tableId: table.id,
          clientRequestId,
          targetStation: primaryStation,
          status: "PENDING",
          items: {
            create: flattenedItems.map(item => ({
              restaurantId: restaurant.id,
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
              station: item.station,
              status: "PENDING",
            })),
          },
        },
        include: {
          items: true,
        },
      })

      const byStation = new Map<Station, typeof order.items>()
      for (const item of order.items) {
        const existing = byStation.get(item.station) ?? []
        existing.push(item)
        byStation.set(item.station, existing)
      }

      for (const [stationKey, stationItems] of byStation.entries()) {
        await tx.kitchenTicket.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            tableId: table.id,
            station: stationKey,
            status: "PENDING",
            items: {
              create: stationItems.map(item => ({
                restaurantId: restaurant.id,
                orderItemId: item.id,
                name: item.name,
                quantity: item.quantity,
                station: item.station,
                status: "PENDING",
              })),
            },
          },
        })
      }

      return order
    })

    await appendSystemEvent(
      "order_submitted",
      {
        orderId: createdOrder.id,
        itemCount: flattenedItems.length,
      },
      {
        req,
        restaurantId: restaurant.id,
        sessionId: session.id,
        tableId: table.id,
        orderId: createdOrder.id,
      }
    )

    if (session.cart && sentCartItemIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          restaurantId: restaurant.id,
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
      orderIds: [createdOrder.id],
      ticketId: createdOrder.id,
      skippedUnconfirmedInactiveItemCount,
    })
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error)
    logWithRequest("ERROR", "orders_post_failed", {
      requestId:
        req.headers.get("x-request-id") ?? crypto.randomUUID(),
      restaurantId:
        req.headers.get("x-restaurant-id") ?? "unknown",
      staffUserId: req.headers.get("x-staff-user-id"),
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
  const restaurant = await resolveRestaurantFromRequest(req)
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
      restaurantId: restaurant.id,
    })

    if (!customerScopedSession) {
      try {
        await requireStaff(req)
      } catch {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
      }
    }

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    })
    if (
      !orderItem ||
      orderItem.restaurantId !== restaurant.id ||
      orderItem.order.restaurantId !== restaurant.id
    ) {
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
      const relatedTicketItems = await prisma.ticketItem.findMany({
        where: {
          restaurantId: restaurant.id,
          orderItemId: orderItem.id,
        },
        select: {
          ticketId: true,
        },
      })
      await prisma.orderItem.delete({
        where: { id: orderItem.id },
      })
      await prisma.ticketItem.deleteMany({
        where: {
          restaurantId: restaurant.id,
          orderItemId: orderItem.id,
        },
      })
      const ticketIds = Array.from(
        new Set(relatedTicketItems.map(item => item.ticketId))
      )
      for (const ticketId of ticketIds) {
        await syncTicketStatus(ticketId, restaurant.id)
      }

      const remainingOpenItems =
        await prisma.orderItem.count({
          where: {
            restaurantId: restaurant.id,
            orderId: orderItem.orderId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        })

      let orderStatus: OrderStatus = orderItem.order.status
      if (remainingOpenItems === 0) {
        await prisma.order.updateMany({
          where: {
            id: orderItem.orderId,
            restaurantId: restaurant.id,
          },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })
        const completedOrder = await prisma.order.findUnique({
          where: { id: orderItem.orderId },
        })
        if (!completedOrder) {
          return NextResponse.json(
            { error: "ORDER_NOT_FOUND" },
            { status: 404 }
          )
        }
        orderStatus = completedOrder.status
        await appendSystemEvent(
          "order_completed",
          { orderId: completedOrder.id },
          {
            req,
            restaurantId: restaurant.id,
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
          restaurantId: restaurant.id,
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

    if (hasQuantityUpdate) {
      await prisma.ticketItem.updateMany({
        where: {
          restaurantId: restaurant.id,
          orderItemId: orderItem.id,
        },
        data: {
          quantity: updatedItem.quantity,
        },
      })
    }

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
          restaurantId: restaurant.id,
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
          restaurantId: restaurant.id,
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
    await requireStaff(req)
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
    if (
      !orderItem ||
      orderItem.restaurantId !== restaurant.id ||
      orderItem.order.restaurantId !== restaurant.id
    ) {
      return NextResponse.json({ error: "ORDER_ITEM_NOT_FOUND" }, { status: 404 })
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })
    const relatedTicketItems = await prisma.ticketItem.findMany({
      where: {
        restaurantId: restaurant.id,
        orderItemId: orderItem.id,
      },
      select: {
        ticketId: true,
      },
    })
    await prisma.ticketItem.updateMany({
      where: {
        restaurantId: restaurant.id,
        orderItemId: orderItem.id,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })
    const ticketIds = Array.from(
      new Set(relatedTicketItems.map(item => item.ticketId))
    )
    for (const ticketId of ticketIds) {
      await syncTicketStatus(ticketId, restaurant.id)
    }

    const updatedOrder = await syncOrderStatus(
      orderItem.orderId,
      restaurant.id
    )
    if (!updatedOrder) {
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 })
    }
    await appendSystemEvent(
      "order_item_completed",
      {
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
      },
      {
        req,
        restaurantId: restaurant.id,
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
          restaurantId: restaurant.id,
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
    where: {
      restaurantId: restaurant.id,
      tableNo: tableNumber,
    },
    select: { id: true },
  })
  if (assignments.length === 0) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }

  const openItems = await prisma.orderItem.findMany({
    where: {
      restaurantId: restaurant.id,
      order: {
        restaurantId: restaurant.id,
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
  const relatedTicketItems = await prisma.ticketItem.findMany({
    where: {
      restaurantId: restaurant.id,
      orderItemId: { in: itemIds },
    },
    select: {
      ticketId: true,
    },
  })

  await prisma.orderItem.updateMany({
    where: {
      restaurantId: restaurant.id,
      id: { in: itemIds },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  })
  await prisma.ticketItem.updateMany({
    where: {
      restaurantId: restaurant.id,
      orderItemId: { in: itemIds },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  })
  const ticketIds = Array.from(
    new Set(relatedTicketItems.map(item => item.ticketId))
  )
  for (const ticketId of ticketIds) {
    await syncTicketStatus(ticketId, restaurant.id)
  }

  const uniqueOrderIds = Array.from(
    new Set(openItems.map(i => i.orderId))
  )
  for (const orderId of uniqueOrderIds) {
    const order = await syncOrderStatus(orderId, restaurant.id)
    if (!order) continue
    if (order.status === "COMPLETED") {
      await appendSystemEvent(
        "order_completed",
        { orderId: order.id },
        {
          req,
          restaurantId: restaurant.id,
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
      restaurantId: restaurant.id,
      tableId: assignments[0].id,
    }
  )

  return NextResponse.json({ completed: itemIds.length })
}

export async function PUT(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  try {
    await requireStaff(req)
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
    { req, restaurantId: restaurant.id }
  )

  return NextResponse.json({ reprinted: true })
}
