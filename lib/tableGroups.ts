import { prisma } from "@/lib/prisma"

export type TableGroupAssignment = {
  id: string
  tableNo: number
  tagId: string
  locked: boolean
  closedAt: Date | null
  closedPaid: boolean | null
  createdAt: Date
  updatedAt: Date
}

export type TableGroup = {
  tableNo: number
  master: TableGroupAssignment
  assignments: TableGroupAssignment[]
}

const assignmentSelect = {
  id: true,
  tableNo: true,
  tagId: true,
  locked: true,
  closedAt: true,
  closedPaid: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getTableGroupByTableNo(
  tableNo: number
): Promise<TableGroup | null> {
  const assignments = await prisma.tableAssignment.findMany({
    where: { tableNo },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: assignmentSelect,
  })

  if (assignments.length === 0) return null

  return {
    tableNo,
    master: assignments[0],
    assignments,
  }
}

export async function getTableGroupByAssignmentId(
  tableId: string
): Promise<TableGroup | null> {
  const assignment = await prisma.tableAssignment.findUnique({
    where: { id: tableId },
    select: { tableNo: true },
  })
  if (!assignment) return null
  return getTableGroupByTableNo(assignment.tableNo)
}

export async function getTableGroupForTag(
  tagId: string
): Promise<TableGroup | null> {
  const assignment = await prisma.tableAssignment.findUnique({
    where: { tagId },
    select: { tableNo: true },
  })
  if (!assignment) return null
  return getTableGroupByTableNo(assignment.tableNo)
}

export function isTableGroupClosed(group: TableGroup) {
  return group.assignments.some(assignment => assignment.closedAt !== null)
}

export function isTableGroupLocked(group: TableGroup) {
  return group.assignments.some(assignment => assignment.locked)
}

export function isTableGroupPaid(group: TableGroup) {
  return (
    group.assignments.length > 0 &&
    group.assignments.every(
      assignment =>
        assignment.closedAt !== null &&
        assignment.closedPaid === true
    )
  )
}
