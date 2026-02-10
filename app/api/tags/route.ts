import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"

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
        orderBy: { createdAt: "desc" },
        take: 1,
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
      active: t._count.sessions > 0,
      tableNumber: t.assignment?.tableNo ?? null,
      activeSessionCount: t._count.sessions,
      lastSeenAt: (t.sessions[0]?.createdAt ?? t.createdAt).toISOString(),
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

  return NextResponse.json(assignment)
}
