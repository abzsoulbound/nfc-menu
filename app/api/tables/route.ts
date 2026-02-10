import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const assignments = await prisma.tableAssignment.findMany({
    orderBy: { tableNo: "asc" },
  })

  return NextResponse.json(
    assignments.map(a => ({
      id: a.id,
      number: a.tableNo,
      locked: false,
      stale: false,
      closed: false,
      paid: false,
      openedAt: a.createdAt.toISOString(),
      contributionWindowEndsAt: new Date(
        a.createdAt.getTime() + 30 * 60 * 1000
      ).toISOString(),
    }))
  )
}
