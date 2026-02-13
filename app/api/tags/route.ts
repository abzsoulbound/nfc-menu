import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import { ensureTagByToken, findTagByToken } from "@/lib/db/tags"
import { getTableGroupByTableNo } from "@/lib/tableGroups"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

export async function GET(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const tags = await prisma.nfcTag.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      assignment: true,
      sessions: {
        where: {
          restaurantId: restaurant.id,
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

export async function POST(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const body = await req.json().catch(() => ({}))
  const tagId =
    typeof body?.tagId === "string"
      ? body.tagId.trim()
      : ""

  if (!tagId || tagId.length > 128) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const existing = await findTagByToken({
    restaurantId: restaurant.id,
    tagId,
  })
  if (existing) {
    return NextResponse.json({
      ok: true,
      created: false,
      tagId,
    })
  }
  await ensureTagByToken({
    restaurantId: restaurant.id,
    tagId,
  })

  await appendSystemEvent(
    "tag_registered",
    { tagId },
    { req, restaurantId: restaurant.id }
  )

  return NextResponse.json(
    {
      ok: true,
      created: true,
      tagId,
    },
    { status: 201 }
  )
}

export async function PATCH(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

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

  const tag = await findTagByToken({
    restaurantId: restaurant.id,
    tagId,
  })
  if (!tag) {
    return NextResponse.json(
      { error: "TAG_NOT_REGISTERED" },
      { status: 404 }
    )
  }

  const previousAssignment = await prisma.tableAssignment.findFirst({
    where: {
      tagId,
      restaurantId: restaurant.id,
    },
    select: {
      tableNo: true,
    },
  })

  if (tableId === null) {
    await prisma.tableAssignment.deleteMany({
      where: {
        tagId,
        restaurantId: restaurant.id,
      },
    })
    await prisma.session.updateMany({
      where: {
        restaurantId: restaurant.id,
        tagId,
        status: "ACTIVE",
      },
      data: {
        tableId: null,
      },
    })

    if (previousAssignment) {
      const previousGroup = await getTableGroupByTableNo(
        previousAssignment.tableNo,
        restaurant.id
      )
      if (previousGroup) {
        const previousGroupTagIds = previousGroup.assignments.map(
          assignment => assignment.tagId
        )
        await prisma.session.updateMany({
          where: {
            restaurantId: restaurant.id,
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
      { req, restaurantId: restaurant.id }
    )
    return NextResponse.json({ ok: true, unassigned: true })
  }

  const table = await prisma.tableAssignment.findUnique({
    where: { id: tableId },
    select: { tableNo: true, restaurantId: true },
  })
  if (!table || table.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }

  const assignment = await prisma.tableAssignment.upsert({
    where: {
      restaurantId_tagId: {
        restaurantId: restaurant.id,
        tagId,
      },
    },
    update: {
      nfcTagId: tag.id,
      tableNo: table.tableNo,
    },
    create: {
      restaurantId: restaurant.id,
      nfcTagId: tag.id,
      tagId,
      tableNo: table.tableNo,
    },
  })
  const tableGroup = await getTableGroupByTableNo(
    table.tableNo,
    restaurant.id
  )
  const masterTableId = tableGroup?.master.id ?? assignment.id

  await prisma.session.updateMany({
    where: {
      restaurantId: restaurant.id,
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
      previousAssignment.tableNo,
      restaurant.id
    )
    if (previousGroup) {
      const previousGroupTagIds = previousGroup.assignments.map(
        assignment => assignment.tagId
      )
      await prisma.session.updateMany({
        where: {
          restaurantId: restaurant.id,
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
    { req, restaurantId: restaurant.id, tableId: masterTableId }
  )

  return NextResponse.json(assignment)
}
