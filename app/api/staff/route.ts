import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"

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

  if (action === "LOCK_TABLE") {
    const table = await prisma.tableAssignment.update({
      where: { id: tableId },
      data: { locked: true },
    })
    await appendSystemEvent(
      "table_locked",
      { tableId },
      { req, tableId }
    )
    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: table.id,
        locked: table.locked,
      },
    })
  }

  if (action === "UNLOCK_TABLE") {
    const table = await prisma.tableAssignment.update({
      where: { id: tableId },
      data: { locked: false },
    })
    await appendSystemEvent(
      "table_unlocked",
      { tableId },
      { req, tableId }
    )
    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: table.id,
        locked: table.locked,
      },
    })
  }

  if (action === "CLOSE_PAID" || action === "CLOSE_UNPAID") {
    const paid = action === "CLOSE_PAID"
    const table = await prisma.tableAssignment.update({
      where: { id: tableId },
      data: {
        closedAt: new Date(),
        closedPaid: paid,
        locked: true,
      },
    })

    await prisma.session.updateMany({
      where: {
        tableId,
        status: "ACTIVE",
      },
      data: {
        status: paid ? "PAID" : "CLOSED",
        closedAt: new Date(),
      },
    })

    await appendSystemEvent(
      "table_closed",
      { tableId, paid },
      { req, tableId }
    )

    return NextResponse.json({
      ok: true,
      action,
      table: {
        id: table.id,
        locked: table.locked,
        closedAt: table.closedAt,
        closedPaid: table.closedPaid,
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

  await appendSystemEvent(
    "staff_message_sent",
    {
      tableId,
      target,
      message,
    },
    { req, tableId }
  )

  return NextResponse.json({ sent: true })
}
