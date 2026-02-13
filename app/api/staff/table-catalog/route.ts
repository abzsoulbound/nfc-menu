import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { getFixedTableNumbers } from "@/lib/tableCatalog"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

export async function GET(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    )
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const fixedTableNumbers = getFixedTableNumbers()
  const fixedSet = new Set(fixedTableNumbers)

  const activeAssignments = await prisma.tableAssignment.findMany({
    where: {
      restaurantId: restaurant.id,
      closedAt: null,
    },
    select: {
      tableNo: true,
    },
    distinct: ["tableNo"],
    orderBy: {
      tableNo: "asc",
    },
  })

  const temporaryTableNumbers = activeAssignments
    .map(assignment => assignment.tableNo)
    .filter(tableNo => !fixedSet.has(tableNo))

  return NextResponse.json({
    fixedTableNumbers,
    temporaryTableNumbers,
  })
}
