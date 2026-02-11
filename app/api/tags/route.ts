import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const tags = await prisma.nfcTag.findMany({
    include: {
      assignment: true,
      sessions: {
        where: {
          status: "ACTIVE",
        },
        orderBy: { lastActivityAt: "desc" },
      },
      _count: {
        select: { sessions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    tags.map(t => ({
      id: t.id,
      active: t.sessions.length > 0,
      tableNumber: t.assignment?.tableNo ?? null,
      activeSessionCount: t.sessions.length,
      totalSessionCount: t._count.sessions,
      lastSeenAt: (
        t.sessions[0]?.lastActivityAt ?? t.createdAt
      ).toISOString(),
    }))
  )
}

export async function PATCH(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { tagId, tableId } = await req.json()
  if (!tagId) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    select: { id: true },
  })
  if (!tag) {
    await prisma.nfcTag.create({
      data: { id: tagId },
    })
  }

  if (tableId === null) {
    await prisma.tableAssignment.deleteMany({
      where: { tagId },
    })
    await appendSystemEvent(
      "tag_unassigned",
      { tagId },
      { req }
    )
    return NextResponse.json({ ok: true, unassigned: true })
  }

  const table = await prisma.tableAssignment.findUnique({
    where: { id: tableId },
    select: { tableNo: true },
  })
  if (!table) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }

  const assignment = await prisma.tableAssignment.upsert({
    where: { tagId },
    update: { tableNo: table.tableNo },
    create: { tagId, tableNo: table.tableNo },
  })

  await appendSystemEvent(
    "tag_assigned",
    {
      tagId,
      tableId,
      tableNo: table.tableNo,
      assignmentId: assignment.id,
    },
    { req, tableId: assignment.id }
  )

  return NextResponse.json(assignment)
}
