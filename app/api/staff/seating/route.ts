import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import {
  getFixedTableNumbers,
  isAllowedTemporaryTableNumber,
} from "@/lib/tableCatalog"

type SeatingErrorPayload = {
  error: string
  [key: string]: unknown
}

class SeatingError extends Error {
  status: number
  payload: SeatingErrorPayload

  constructor(status: number, payload: SeatingErrorPayload) {
    super(payload.error)
    this.status = status
    this.payload = payload
  }
}

function normalizeTagIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const normalized = raw
    .map(value => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)

  const unique = new Set(normalized)
  return Array.from(unique)
}

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const tableNo = Number(body?.tableNo)
  const isTemporary = body?.isTemporary === true
  const tagIds = normalizeTagIds(body?.tagIds)

  if (
    !Number.isInteger(tableNo) ||
    tableNo <= 0 ||
    tagIds.length === 0 ||
    tagIds.some(tagId => tagId.length > 128)
  ) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const fixedTableNumbers = getFixedTableNumbers()
  const fixedSet = new Set(fixedTableNumbers)
  const tableIsFixed = fixedSet.has(tableNo)

  if (!tableIsFixed && !isTemporary) {
    return NextResponse.json(
      { error: "TABLE_TEMPORARY_REQUIRED", tableNo },
      { status: 400 }
    )
  }

  if (tableIsFixed && isTemporary) {
    return NextResponse.json(
      { error: "TABLE_FIXED_RESERVED", tableNo },
      { status: 400 }
    )
  }

  if (!tableIsFixed && !isAllowedTemporaryTableNumber(tableNo)) {
    return NextResponse.json(
      { error: "TABLE_NOT_ALLOWED", tableNo },
      { status: 400 }
    )
  }

  const registeredTags = await prisma.nfcTag.findMany({
    where: {
      id: {
        in: tagIds,
      },
    },
    select: {
      id: true,
    },
  })
  const registeredSet = new Set(registeredTags.map(tag => tag.id))
  const missingTagIds = tagIds.filter(tagId => !registeredSet.has(tagId))
  if (missingTagIds.length > 0) {
    return NextResponse.json(
      {
        error: "TAG_NOT_REGISTERED",
        missingTagIds,
      },
      { status: 404 }
    )
  }

  try {
    const result = await prisma.$transaction(
      async tx => {
        const previousAssignments = await tx.tableAssignment.findMany({
          where: {
            OR: [
              {
                tagId: {
                  in: tagIds,
                },
              },
              {
                tableNo,
              },
            ],
          },
          select: {
            tagId: true,
            tableNo: true,
            closedAt: true,
          },
        })

        const tagIdSet = new Set(tagIds)

        const conflictingAssignments = previousAssignments.filter(
          assignment =>
            tagIdSet.has(assignment.tagId) &&
            assignment.tableNo !== tableNo &&
            assignment.closedAt === null
        )
        if (conflictingAssignments.length > 0) {
          throw new SeatingError(409, {
            error: "TAG_ALREADY_ASSIGNED",
            conflicts: conflictingAssignments.map(assignment => ({
              tagId: assignment.tagId,
              tableNo: assignment.tableNo,
            })),
          })
        }

        const currentTableTagIds = previousAssignments
          .filter(assignment => assignment.tableNo === tableNo)
          .map(assignment => assignment.tagId)

        const tagsToUnassign = currentTableTagIds.filter(
          currentTagId => !tagIdSet.has(currentTagId)
        )

        for (const tagId of tagIds) {
          await tx.tableAssignment.upsert({
            where: { tagId },
            update: {
              tableNo,
              locked: false,
              closedAt: null,
              closedPaid: null,
            },
            create: {
              tagId,
              tableNo,
              locked: false,
              closedAt: null,
              closedPaid: null,
            },
          })
        }

        if (tagsToUnassign.length > 0) {
          await tx.tableAssignment.deleteMany({
            where: {
              tableNo,
              tagId: {
                in: tagsToUnassign,
              },
            },
          })
        }

        const impactedTableNumbers = new Set<number>([tableNo])
        for (const assignment of previousAssignments) {
          impactedTableNumbers.add(assignment.tableNo)
        }

        let masterTableId: string | null = null

        for (const impactedTableNo of impactedTableNumbers) {
          const assignments = await tx.tableAssignment.findMany({
            where: {
              tableNo: impactedTableNo,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              tagId: true,
            },
          })

          if (assignments.length === 0) continue

          const nextMasterId = assignments[0].id
          if (impactedTableNo === tableNo) {
            masterTableId = nextMasterId
          }

          await tx.tableAssignment.updateMany({
            where: {
              tableNo: impactedTableNo,
            },
            data: {
              locked: false,
              closedAt: null,
              closedPaid: null,
            },
          })

          await tx.session.updateMany({
            where: {
              tagId: {
                in: assignments.map(assignment => assignment.tagId),
              },
              status: "ACTIVE",
            },
            data: {
              tableId: nextMasterId,
            },
          })
        }

        if (tagsToUnassign.length > 0) {
          await tx.session.updateMany({
            where: {
              tagId: {
                in: tagsToUnassign,
              },
              status: "ACTIVE",
            },
            data: {
              tableId: null,
            },
          })
        }

        if (!masterTableId) {
          throw new SeatingError(500, {
            error: "SEATING_FAILED",
          })
        }

        return {
          masterTableId,
          assignedTagIds: tagIds,
          unassignedTagIds: tagsToUnassign,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    await appendSystemEvent(
      "table_seated",
      {
        tableNo,
        isTemporary: !tableIsFixed,
        assignedTagIds: result.assignedTagIds,
        unassignedTagIds: result.unassignedTagIds,
        masterTableId: result.masterTableId,
      },
      { req, tableId: result.masterTableId }
    )

    return NextResponse.json({
      ok: true,
      tableNo,
      assignedTagIds: result.assignedTagIds,
      masterTableId: result.masterTableId,
    })
  } catch (error) {
    if (error instanceof SeatingError) {
      return NextResponse.json(error.payload, {
        status: error.status,
      })
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "SEATING_CONFLICT_RETRY" },
        { status: 409 }
      )
    }

    throw error
  }
}
