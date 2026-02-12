import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { getFixedTableNumbers } from "@/lib/tableCatalog"

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    )
  }

  const fixedTableNumbers = getFixedTableNumbers()
  const fixedSet = new Set(fixedTableNumbers)

  const activeAssignments = await prisma.tableAssignment.findMany({
    where: {
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
