import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import {
  CONTRIBUTION_WINDOW_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from "@/lib/constants"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const assignments = await prisma.tableAssignment.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ tableNo: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    include: {
      sessions: {
        where: {
          restaurantId: restaurant.id,
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

  const grouped = new Map<number, typeof assignments>()
  for (const assignment of assignments) {
    const existing = grouped.get(assignment.tableNo) ?? []
    existing.push(assignment)
    grouped.set(assignment.tableNo, existing)
  }

  const rows = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, groupAssignments]) => {
      const master = groupAssignments[0]
      const sessions = groupAssignments.flatMap(a => a.sessions)
      const closed = groupAssignments.some(a => a.closedAt !== null)
      const locked = groupAssignments.some(a => a.locked)
      const paid =
        closed &&
        groupAssignments.every(
          a => a.closedAt !== null && a.closedPaid === true
        )
      const latestActivityMs =
        sessions.length > 0
          ? Math.max(
              ...sessions.map(s => s.lastActivityAt.getTime())
            )
          : null
      const openedAtMs =
        sessions.length > 0
          ? Math.min(
              ...sessions.map(s => s.openedAt.getTime())
            )
          : master.createdAt.getTime()

      return {
        id: master.id,
        number: master.tableNo,
        locked,
        stale:
          !closed &&
          latestActivityMs !== null &&
          Date.now() - latestActivityMs >
            SESSION_IDLE_TIMEOUT_MS,
        closed,
        paid,
        openedAt: new Date(openedAtMs).toISOString(),
        contributionWindowEndsAt: new Date(
          openedAtMs + CONTRIBUTION_WINDOW_MS
        ).toISOString(),
      }
    })

  return NextResponse.json(rows)
}
