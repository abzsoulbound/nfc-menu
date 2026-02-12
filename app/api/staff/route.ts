import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import { getTableGroupByAssignmentId } from "@/lib/tableGroups"

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { action, tableId } = await req.json()
  if (typeof action !== "string" || typeof tableId !== "string") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tableGroup = await getTableGroupByAssignmentId(tableId)
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
      where: { id: { in: groupTableIds } },
      data: { locked: true },
    })
    await appendSystemEvent(
      "table_locked",
      { tableId: masterTableId, groupedTableIds: groupTableIds },
      { req, tableId: masterTableId }
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
      where: { id: { in: groupTableIds } },
      data: { locked: false },
    })
    await appendSystemEvent(
      "table_unlocked",
      { tableId: masterTableId, groupedTableIds: groupTableIds },
      { req, tableId: masterTableId }
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

    await prisma.tableAssignment.updateMany({
      where: { id: { in: groupTableIds } },
      data: {
        closedAt,
        closedPaid: paid,
        locked: true,
      },
    })

    await prisma.session.updateMany({
      where: {
        tableId: { in: groupTableIds },
        status: "ACTIVE",
      },
      data: {
        status: paid ? "PAID" : "CLOSED",
        closedAt,
      },
    })

    await appendSystemEvent(
      "table_closed",
      { tableId: masterTableId, paid, groupedTableIds: groupTableIds },
      { req, tableId: masterTableId }
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
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { tableId, target, message } = await req.json()
  if (!tableId || !target || !message) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tableGroup = await getTableGroupByAssignmentId(tableId)
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
    { req, tableId: masterTableId }
  )

  return NextResponse.json({ sent: true })
}
