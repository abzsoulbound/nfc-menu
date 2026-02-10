import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"

function toStation(value: string) {
  return value.toLowerCase() === "bar" ? "bar" : "kitchen"
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const station = searchParams.get("station")
  const tableNumberRaw = searchParams.get("tableNumber")

  if (station) {
    try {
      requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const targetStation = toStation(station)
    const tickets = await prisma.kitchenTicket.findMany({
      where: { readyAt: null },
      include: { items: true, table: true },
      orderBy: { createdAt: "asc" },
    })

    const rows = tickets.flatMap(ticket =>
      ticket.items
        .filter(i => i.station.toLowerCase() === targetStation)
        .map(i => ({
          orderId: ticket.id,
          tableNumber: ticket.table.tableNo,
          name: i.name,
          quantity: i.quantity,
          edits: null,
          submittedAt: ticket.createdAt.toISOString(),
        }))
    )

    return NextResponse.json(rows)
  }

  if (tableNumberRaw) {
    try {
      requireStaff(req)
    } catch {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const tableNumber = Number(tableNumberRaw)
    if (!Number.isFinite(tableNumber)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
    }

    const assignments = await prisma.tableAssignment.findMany({
      where: { tableNo: tableNumber },
      select: { id: true },
    })
    if (assignments.length === 0) {
      return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
    }

    const tickets = await prisma.kitchenTicket.findMany({
      where: { tableId: { in: assignments.map(a => a.id) } },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    })

    const groups = tickets.map(t => ({
      orderId: t.id,
      submittedAt: t.createdAt.toISOString(),
      items: t.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        edits: null,
        submittedAt: t.createdAt.toISOString(),
      })),
    }))

    return NextResponse.json({
      tableNumber,
      firstSubmittedAt: groups[0]?.submittedAt ?? new Date().toISOString(),
      initialOrders: groups.slice(0, 1),
      addonOrders: groups.slice(1),
    })
  }

  return NextResponse.json([])
}

export async function POST(req: Request) {
  const { tagId, items } = await req.json()
  if (!tagId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    include: { assignment: true },
  })
  if (!tag?.assignment) {
    return NextResponse.json({ error: "TABLE_NOT_ASSIGNED" }, { status: 400 })
  }

  const ticket = await prisma.kitchenTicket.create({
    data: {
      tableId: tag.assignment.id,
      items: {
        create: items.map((i: any) => ({
          name: String(i.name ?? "Item"),
          quantity: Number(i.quantity ?? 1),
          station: toStation(String(i.station ?? "KITCHEN")),
        })),
      },
    },
  })

  return NextResponse.json({ ticketId: ticket.id })
}

export async function PATCH(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { tableNumber } = await req.json()
  if (typeof tableNumber !== "number") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const assignments = await prisma.tableAssignment.findMany({
    where: { tableNo: tableNumber },
    select: { id: true },
  })
  if (assignments.length === 0) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }

  const result = await prisma.kitchenTicket.updateMany({
    where: {
      tableId: { in: assignments.map(a => a.id) },
      readyAt: null,
    },
    data: { readyAt: new Date() },
  })

  return NextResponse.json({ completed: result.count })
}

export async function PUT(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const { tableNumber } = await req.json()
  if (typeof tableNumber !== "number") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  return NextResponse.json({ reprinted: true })
}
