import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import {
  CONTRIBUTION_WINDOW_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "@/lib/constants"

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const assignments = await prisma.tableAssignment.findMany({
    orderBy: { tableNo: "asc" },
    include: {
      sessions: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          openedAt: "asc",
        },
        select: {
          openedAt: true,
          lastActivityAt: true,
          id: true,
        },
      },
    },
  })

  return NextResponse.json(
    assignments.map(a => ({
      id: a.id,
      number: a.tableNo,
      locked: a.locked,
      stale:
        a.closedAt === null &&
        a.sessions.length > 0 &&
        Date.now() -
          Math.max(
            ...a.sessions.map(s => s.lastActivityAt.getTime())
          ) >
          SESSION_IDLE_TIMEOUT_MS,
      closed: a.closedAt !== null,
      paid: a.closedPaid ?? false,
      openedAt: (
        a.sessions[0]?.openedAt ?? a.createdAt
      ).toISOString(),
      contributionWindowEndsAt: new Date(
        (a.sessions[0]?.openedAt ?? a.createdAt).getTime() +
          CONTRIBUTION_WINDOW_MS
      ).toISOString(),
    }))
  )
}
