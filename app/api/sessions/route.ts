import { NextResponse } from "next/server"
import { SessionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/constants"
import { appendSystemEvent } from "@/lib/events"

function inferOrigin(tagId: string) {
  return tagId.startsWith("staff-") ? "STAFF" : "CUSTOMER"
}

function toSessionDto(session: {
  id: string
  tagId: string
  tableId: string | null
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
    tableNumber: session.tag?.assignment?.tableNo ?? null,
    openedAt: session.openedAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    status: session.status.toLowerCase(),
    stale,
  }
}

async function ensureTagId(
  tagId: string | undefined,
  origin: string | undefined
) {
  if (tagId) {
    const existing = await prisma.nfcTag.findUnique({
      where: { id: tagId },
      select: { id: true },
    })
    if (!existing) {
      await prisma.nfcTag.create({
        data: { id: tagId },
      })
    }
    return tagId
  }

  if (origin === "STAFF") {
    const staffTagId = `staff-${crypto.randomUUID()}`
    await prisma.nfcTag.create({
      data: { id: staffTagId },
    })
    return staffTagId
  }

  const customerTagId = `anon-${crypto.randomUUID()}`
  await prisma.nfcTag.create({
    data: { id: customerTagId },
  })
  return customerTagId
}

function isStale(lastActivityAt: Date) {
  return (
    Date.now() - lastActivityAt.getTime() >
    SESSION_IDLE_TIMEOUT_MS
  )
}

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const sessions = await prisma.session.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: { openedAt: "desc" },
    include: {
      tag: {
        include: { assignment: true },
      },
    },
  })

  return NextResponse.json(sessions.map(toSessionDto))
}

export async function POST(req: Request) {
  const { sessionId, origin, tagId } = await req.json()

  if (sessionId) {
    const existing = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tag: {
          include: { assignment: true },
        },
        cart: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 })
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
        { req, sessionId: existing.id, tableId: existing.tableId }
      )
      return NextResponse.json({ error: "SESSION_STALE" }, { status: 410 })
    }

    if (!existing.cart) {
      await prisma.sessionCart.create({
        data: { sessionId: existing.id },
      })
    }

    const resumed = await prisma.session.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        tableId:
          existing.tableId ??
          existing.tag.assignment?.id ??
          null,
      },
      include: {
        tag: {
          include: { assignment: true },
        },
      },
    })

    await appendSystemEvent(
      "session_resumed",
      { sessionId: resumed.id },
      { req, sessionId: resumed.id, tableId: resumed.tableId }
    )

    return NextResponse.json(toSessionDto(resumed))
  }

  const resolvedTagId = await ensureTagId(tagId, origin)
  const tag = await prisma.nfcTag.findUnique({
    where: { id: resolvedTagId },
    include: { assignment: true },
  })

  const tableId = tag?.assignment?.id ?? null
  if (tag?.assignment?.closedAt) {
    return NextResponse.json(
      { error: "TABLE_CLOSED" },
      { status: 409 }
    )
  }

  const activeForTag = await prisma.session.findFirst({
    where: {
      tagId: resolvedTagId,
      status: "ACTIVE",
    },
    orderBy: { lastActivityAt: "desc" },
    include: {
      tag: {
        include: { assignment: true },
      },
      cart: true,
    },
  })

  if (activeForTag && !isStale(activeForTag.lastActivityAt)) {
    if (!activeForTag.cart) {
      await prisma.sessionCart.create({
        data: { sessionId: activeForTag.id },
      })
    }
    const resumed = await prisma.session.update({
      where: { id: activeForTag.id },
      data: {
        lastActivityAt: new Date(),
        tableId:
          activeForTag.tableId ??
          activeForTag.tag.assignment?.id ??
          null,
      },
      include: {
        tag: {
          include: { assignment: true },
        },
      },
    })

    await appendSystemEvent(
      "session_reused_for_tag",
      { sessionId: resumed.id, tagId: resolvedTagId },
      { req, sessionId: resumed.id, tableId: resumed.tableId }
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
      { sessionId: activeForTag.id, tagId: resolvedTagId },
      { req, sessionId: activeForTag.id, tableId: activeForTag.tableId }
    )
  }

  const session = await prisma.session.create({
    data: {
      tagId: resolvedTagId,
      tableId,
      status: "ACTIVE",
      openedAt: new Date(),
      lastActivityAt: new Date(),
    },
    include: {
      tag: {
        include: { assignment: true },
      },
    },
  })

  await prisma.sessionCart.create({
    data: { sessionId: session.id },
  })

  await appendSystemEvent(
    "session_created",
    {
      sessionId: session.id,
      tagId: resolvedTagId,
      origin: origin ?? inferOrigin(resolvedTagId),
    },
    { req, sessionId: session.id, tableId: session.tableId }
  )

  return NextResponse.json(toSessionDto(session))
}
