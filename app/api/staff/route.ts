import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import { getTableGroupByAssignmentId } from "@/lib/tableGroups"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

export async function POST(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const { action, tableId } = await req.json()
  if (typeof action !== "string" || typeof tableId !== "string") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tableGroup = await getTableGroupByAssignmentId(
    tableId,
    restaurant.id
  )
  if (!tableGroup) {
    return NextResponse.json(
      { error: "TABLE_NOT_FOUND" },
      { status: 404 }
    )
  }
  const groupTableIds = tableGroup.assignments.map(
    assignment => assignment.id
  )
  const masterTableId = tableGroup.master.id

  if (action === "LOCK_TABLE") {
    await prisma.tableAssignment.updateMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: groupTableIds },
      },
      data: { locked: true },
    })
    await appendSystemEvent(
      "table_locked",
      { tableId: masterTableId, groupedTableIds: groupTableIds },
      { req, restaurantId: restaurant.id, tableId: masterTableId }
    )
    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: masterTableId,
        locked: true,
      },
    })
  }

  if (action === "UNLOCK_TABLE") {
    await prisma.tableAssignment.updateMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: groupTableIds },
      },
      data: { locked: false },
    })
    await appendSystemEvent(
      "table_unlocked",
      { tableId: masterTableId, groupedTableIds: groupTableIds },
      { req, restaurantId: restaurant.id, tableId: masterTableId }
    )
    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: masterTableId,
        locked: false,
      },
    })
  }

  if (action === "CLOSE_PAID" || action === "CLOSE_UNPAID") {
    const paid = action === "CLOSE_PAID"
    const closedAt = new Date()
    const groupTagIds = tableGroup.assignments.map(
      assignment => assignment.tagId
    )

    await prisma.tableAssignment.updateMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: groupTableIds },
      },
      data: {
        closedAt,
        closedPaid: paid,
        locked: true,
      },
    })

    await prisma.session.updateMany({
      where: {
        restaurantId: restaurant.id,
        tableId: { in: groupTableIds },
        status: "ACTIVE",
      },
      data: {
        status: paid ? "PAID" : "CLOSED",
        closedAt,
      },
    })
    await prisma.session.updateMany({
      where: {
        restaurantId: restaurant.id,
        tagId: { in: groupTagIds },
        status: "ACTIVE",
      },
      data: {
        status: paid ? "PAID" : "CLOSED",
        closedAt,
      },
    })

    await prisma.tableAssignment.deleteMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: groupTableIds },
      },
    })

    await appendSystemEvent(
      "table_closed",
      {
        tableId: masterTableId,
        paid,
        groupedTableIds: groupTableIds,
        groupedTagIds: groupTagIds,
        unassignedOnClose: true,
      },
      { req, restaurantId: restaurant.id, tableId: masterTableId }
    )

    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: masterTableId,
        locked: true,
        closedAt,
        closedPaid: paid,
      },
    })
  }

  return NextResponse.json(
    { error: "UNKNOWN_ACTION" },
    { status: 400 }
  )
}

export async function PUT(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const { tableId, target, message } = await req.json()
  if (!tableId || !target || !message) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tableGroup = await getTableGroupByAssignmentId(
    tableId,
    restaurant.id
  )
  if (!tableGroup) {
    return NextResponse.json(
      { error: "TABLE_NOT_FOUND" },
      { status: 404 }
    )
  }
  const masterTableId = tableGroup.master.id

  await appendSystemEvent(
    "staff_message_sent",
    {
      tableId: masterTableId,
      target,
      message,
    },
    { req, restaurantId: restaurant.id, tableId: masterTableId }
  )

  return NextResponse.json({ sent: true })
}
