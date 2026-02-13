import { NextResponse } from "next/server"
import { SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/constants"
import { appendSystemEvent } from "@/lib/events"
import { ensureTagByToken, findTagByToken } from "@/lib/db/tags"
import {
  getTableGroupForTag,
  isTableGroupClosed,
} from "@/lib/tableGroups"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

function inferOrigin(tagId: string) {
  return tagId.startsWith("staff-") ? "STAFF" : "CUSTOMER"
}

function toSessionDto(session: {
  id: string
  tagId: string
  tableId: string | null
  table?: { tableNo: number } | null
  openedAt: Date
  lastActivityAt: Date
  status: SessionStatus
  tag?: { assignment: { id: string; tableNo: number } | null } | null
}) {
  const stale =
    Date.now() - session.lastActivityAt.getTime() >
    SESSION_IDLE_TIMEOUT_MS

  return {
    id: session.id,
    origin: inferOrigin(session.tagId),
    tagId: session.tagId,
    tableId:
      session.tableId ?? session.tag?.assignment?.id ?? null,
    tableNumber:
      session.table?.tableNo ?? session.tag?.assignment?.tableNo ?? null,
    openedAt: session.openedAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    status: session.status.toLowerCase(),
    stale,
  }
}

class SessionRouteError extends Error {
  status: number
  payload: { error: string }

  constructor(status: number, payload: { error: string }) {
    super(payload.error)
    this.status = status
    this.payload = payload
  }
}

async function ensureTag(
  tagId: string | undefined,
  origin: string | undefined,
  restaurantId: string
) {
  if (tagId) {
    const existing = await findTagByToken({
      restaurantId,
      tagId,
    })
    if (!existing) {
      throw new SessionRouteError(404, {
        error: "TAG_NOT_REGISTERED",
      })
    }
    return existing
  }

  if (origin === "STAFF") {
    const staffTagId = `staff-${crypto.randomUUID()}`
    return ensureTagByToken({
      restaurantId,
      tagId: staffTagId,
    })
  }

  throw new SessionRouteError(400, {
    error: "BAD_REQUEST",
  })
}

function isStale(lastActivityAt: Date) {
  return (
    Date.now() - lastActivityAt.getTime() >
    SESSION_IDLE_TIMEOUT_MS
  )
}

export async function GET(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const sessions = await prisma.session.findMany({
    where: {
      restaurantId: restaurant.id,
      status: "ACTIVE",
    },
    orderBy: { openedAt: "desc" },
    include: {
      table: {
        select: { tableNo: true },
      },
      tag: {
        include: { assignment: true },
      },
    },
  })

  return NextResponse.json(sessions.map(toSessionDto))
}

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const body = await req.json()
  const sessionId =
    typeof body?.sessionId === "string"
      ? body.sessionId.trim()
      : undefined
  const originRaw =
    typeof body?.origin === "string"
      ? body.origin
      : undefined
  const origin = originRaw?.toUpperCase()
  const tagId =
    typeof body?.tagId === "string"
      ? body.tagId.trim()
      : undefined

  if (
    origin &&
    origin !== "STAFF" &&
    origin !== "CUSTOMER"
  ) {
    return NextResponse.json(
      { error: "BAD_REQUEST" },
      { status: 400 }
    )
  }

  if (
    (sessionId && sessionId.length > 128) ||
    (tagId && tagId.length > 128)
  ) {
    return NextResponse.json(
      { error: "BAD_REQUEST" },
      { status: 400 }
    )
  }

  if (origin === "STAFF") {
    try {
      await requireStaff(req)
    } catch {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      )
    }
  }

  if (sessionId) {
    const existing = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        table: {
          select: { tableNo: true },
        },
        tag: {
          include: { assignment: true },
        },
        cart: true,
      },
    })
    if (!existing || existing.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 })
    }

    if (tagId && existing.tagId !== tagId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (
      existing.status !== "ACTIVE" ||
      isStale(existing.lastActivityAt)
    ) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      })
      await appendSystemEvent(
        "session_closed_stale",
        { sessionId: existing.id },
        {
          req,
          restaurantId: restaurant.id,
          sessionId: existing.id,
          tableId: existing.tableId,
        }
      )
      return NextResponse.json({ error: "SESSION_STALE" }, { status: 410 })
    }

    if (!existing.cart) {
      await prisma.sessionCart.create({
        data: {
          sessionId: existing.id,
          restaurantId: restaurant.id,
        },
      })
    }

    const existingTableGroup = await getTableGroupForTag(
      existing.tagId,
      restaurant.id
    )
    const tableRequired = !existing.tagId.startsWith("staff-")
    if (tableRequired && !existingTableGroup) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      })
      return NextResponse.json(
        { error: "TABLE_NOT_SEATED" },
        { status: 409 }
      )
    }
    const masterTableId = existingTableGroup?.master.id ?? null

    const resumed = await prisma.session.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        tableId: masterTableId,
      },
      include: {
        table: {
          select: { tableNo: true },
        },
        tag: {
          include: { assignment: true },
        },
      },
    })

    await appendSystemEvent(
      "session_resumed",
      { sessionId: resumed.id },
      {
        req,
        restaurantId: restaurant.id,
        sessionId: resumed.id,
        tableId: resumed.tableId,
      }
    )

    return NextResponse.json(toSessionDto(resumed))
  }

  let resolvedTag: { id: string; tagId: string }
  try {
    resolvedTag = await ensureTag(tagId, origin, restaurant.id)
  } catch (error) {
    if (error instanceof SessionRouteError) {
      return NextResponse.json(error.payload, {
        status: error.status,
      })
    }
    throw error
  }

  const tagTableGroup = await getTableGroupForTag(
    resolvedTag.tagId,
    restaurant.id
  )
  const tableRequired = !resolvedTag.tagId.startsWith("staff-")
  if (tableRequired && !tagTableGroup) {
    await prisma.session.updateMany({
      where: {
        restaurantId: restaurant.id,
        tagId: resolvedTag.tagId,
        status: "ACTIVE",
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    })
    return NextResponse.json(
      { error: "TABLE_NOT_SEATED" },
      { status: 409 }
    )
  }

  const tableId = tagTableGroup?.master.id ?? null
  if (tagTableGroup && isTableGroupClosed(tagTableGroup)) {
    return NextResponse.json(
      { error: "TABLE_CLOSED" },
      { status: 409 }
    )
  }

  const activeForTag = await prisma.session.findFirst({
    where: {
      restaurantId: restaurant.id,
      tagId: resolvedTag.tagId,
      status: "ACTIVE",
    },
    orderBy: { lastActivityAt: "desc" },
    include: {
      table: {
        select: { tableNo: true },
      },
      tag: {
        include: { assignment: true },
      },
      cart: true,
    },
  })

  if (activeForTag && !isStale(activeForTag.lastActivityAt)) {
    if (!activeForTag.cart) {
      await prisma.sessionCart.create({
        data: {
          sessionId: activeForTag.id,
          restaurantId: restaurant.id,
        },
      })
    }
    const resumed = await prisma.session.update({
      where: { id: activeForTag.id },
      data: {
        lastActivityAt: new Date(),
        tableId,
      },
      include: {
        table: {
          select: { tableNo: true },
        },
        tag: {
          include: { assignment: true },
        },
      },
    })

    await appendSystemEvent(
      "session_reused_for_tag",
      { sessionId: resumed.id, tagId: resolvedTag.tagId },
      {
        req,
        restaurantId: restaurant.id,
        sessionId: resumed.id,
        tableId: resumed.tableId,
      }
    )

    return NextResponse.json(toSessionDto(resumed))
  }

  if (activeForTag && isStale(activeForTag.lastActivityAt)) {
    await prisma.session.update({
      where: { id: activeForTag.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    })
    await appendSystemEvent(
      "session_closed_stale",
      { sessionId: activeForTag.id, tagId: resolvedTag.tagId },
      {
        req,
        restaurantId: restaurant.id,
        sessionId: activeForTag.id,
        tableId: activeForTag.tableId,
      }
    )
  }

  const session = await prisma.session.create({
    data: {
      restaurantId: restaurant.id,
      nfcTagId: resolvedTag.id,
      tagId: resolvedTag.tagId,
      tableId,
      status: "ACTIVE",
      openedAt: new Date(),
      lastActivityAt: new Date(),
    },
    include: {
      table: {
        select: { tableNo: true },
      },
      tag: {
        include: { assignment: true },
      },
    },
  })

  await prisma.sessionCart.create({
    data: {
      sessionId: session.id,
      restaurantId: restaurant.id,
    },
  })

  await appendSystemEvent(
    "session_created",
    {
      sessionId: session.id,
      tagId: resolvedTag.tagId,
      origin: origin ?? inferOrigin(resolvedTag.tagId),
    },
    {
      req,
      restaurantId: restaurant.id,
      sessionId: session.id,
      tableId: session.tableId,
    }
  )

  return NextResponse.json(toSessionDto(session))
}
