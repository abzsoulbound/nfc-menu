import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"

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

  if (action === "CLOSE_PAID" || action === "CLOSE_UNPAID") {
    await prisma.kitchenTicket.deleteMany({
      where: { tableId },
    })
  }

  return NextResponse.json({ ok: true, action })
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

  return NextResponse.json({ sent: true })
}
