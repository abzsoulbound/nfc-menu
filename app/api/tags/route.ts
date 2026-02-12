import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import { getTableGroupByTableNo } from "@/lib/tableGroups"

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

  const body = await req.json()
  const tagId =
    typeof body?.tagId === "string"
      ? body.tagId.trim()
      : ""
  const tableIdRaw = body?.tableId
  const tableId =
    typeof tableIdRaw === "string"
      ? tableIdRaw.trim()
      : tableIdRaw === null
      ? null
      : undefined

  if (
    !tagId ||
    tagId.length > 128 ||
    tableId === undefined
  ) {
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

  const previousAssignment = await prisma.tableAssignment.findUnique({
    where: { tagId },
    select: {
      tableNo: true,
    },
  })

  if (tableId === null) {
    await prisma.tableAssignment.deleteMany({
      where: { tagId },
    })
    await prisma.session.updateMany({
      where: {
        tagId,
        status: "ACTIVE",
      },
      data: {
        tableId: null,
      },
    })

    if (previousAssignment) {
      const previousGroup = await getTableGroupByTableNo(
        previousAssignment.tableNo
      )
      if (previousGroup) {
        const previousGroupTagIds = previousGroup.assignments.map(
          assignment => assignment.tagId
        )
        await prisma.session.updateMany({
          where: {
            tagId: { in: previousGroupTagIds },
            status: "ACTIVE",
          },
          data: {
            tableId: previousGroup.master.id,
          },
        })
      }
    }

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
  const tableGroup = await getTableGroupByTableNo(table.tableNo)
  const masterTableId = tableGroup?.master.id ?? assignment.id

  await prisma.session.updateMany({
    where: {
      tagId,
      status: "ACTIVE",
    },
    data: {
      tableId: masterTableId,
    },
  })

  if (
    previousAssignment &&
    previousAssignment.tableNo !== table.tableNo
  ) {
    const previousGroup = await getTableGroupByTableNo(
      previousAssignment.tableNo
    )
    if (previousGroup) {
      const previousGroupTagIds = previousGroup.assignments.map(
        assignment => assignment.tagId
      )
      await prisma.session.updateMany({
        where: {
          tagId: { in: previousGroupTagIds },
          status: "ACTIVE",
        },
        data: {
          tableId: previousGroup.master.id,
        },
      })
    }
  }

  await appendSystemEvent(
    "tag_assigned",
    {
      tagId,
      tableId: masterTableId,
      tableNo: table.tableNo,
      assignmentId: assignment.id,
    },
    { req, tableId: masterTableId }
  )

  return NextResponse.json(assignment)
}
