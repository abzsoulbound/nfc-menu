import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"

function inferOrigin(tagId: string) {
  return tagId.startsWith("staff-") ? "STAFF" : "CUSTOMER"
}

function toSessionDto(session: {
  id: string
  tagId: string
  createdAt: Date
  tag?: { assignment: { id: string } | null } | null
}) {
  return {
    id: session.id,
    origin: inferOrigin(session.tagId),
    tagId: session.tagId,
    tableId: session.tag?.assignment?.id ?? null,
    lastActivityAt: session.createdAt.toISOString(),
    stale: false,
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

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
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

    if (!existing.cart) {
      await prisma.sessionCart.create({
        data: { sessionId: existing.id },
      })
    }

    return NextResponse.json(toSessionDto(existing))
  }

  const resolvedTagId = await ensureTagId(tagId, origin)
  const session = await prisma.session.create({
    data: { tagId: resolvedTagId },
    include: {
      tag: {
        include: { assignment: true },
      },
    },
  })

  await prisma.sessionCart.create({
    data: { sessionId: session.id },
  })

  return NextResponse.json(toSessionDto(session))
}
