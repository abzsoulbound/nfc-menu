import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { appendSystemEvent } from "@/lib/events"
import {
  ensureTagByToken,
  normalizeTagToken,
} from "@/lib/db/tags"
import {
  getFixedTableNumbers,
  isAllowedTemporaryTableNumber,
} from "@/lib/tableCatalog"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

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
    .map(value =>
      typeof value === "string" ? normalizeTagToken(value) : ""
    )
    .filter(Boolean)

  const unique = new Set(normalized)
  return Array.from(unique)
}

export async function POST(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

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

  const resolvedTags = await Promise.all(
    tagIds.map(tagId =>
      ensureTagByToken({
        restaurantId: restaurant.id,
        tagId,
      })
    )
  )

  const canonicalTagIds = Array.from(
    new Set(
      resolvedTags
        .map(tag => tag?.tagId)
        .filter((tagId): tagId is string => Boolean(tagId))
    )
  )
  const tagIdToNfcTagId = new Map(
    resolvedTags
      .filter((tag): tag is { id: string; tagId: string } => Boolean(tag))
      .map(tag => [tag.tagId, tag.id])
  )

  try {
    const result = await prisma.$transaction(
      async tx => {
        const previousAssignments = await tx.tableAssignment.findMany({
          where: {
            restaurantId: restaurant.id,
            OR: [
              {
                tagId: {
                  in: canonicalTagIds,
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

        const tagIdSet = new Set(canonicalTagIds)

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

        for (const tagId of canonicalTagIds) {
          const nfcTagId = tagIdToNfcTagId.get(tagId)
          if (!nfcTagId) {
            throw new SeatingError(404, {
              error: "TAG_NOT_REGISTERED",
              missingTagIds: [tagId],
            })
          }
          await tx.tableAssignment.upsert({
            where: {
              restaurantId_tagId: {
                restaurantId: restaurant.id,
                tagId,
              },
            },
            update: {
              nfcTagId,
              tableNo,
              locked: false,
              closedAt: null,
              closedPaid: null,
            },
            create: {
              restaurantId: restaurant.id,
              nfcTagId,
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
              restaurantId: restaurant.id,
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
              restaurantId: restaurant.id,
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

          const groupedTagIds = assignments.map(
            assignment => assignment.tagId
          )

          await tx.tableAssignment.updateMany({
            where: {
              restaurantId: restaurant.id,
              tableNo: impactedTableNo,
            },
            data: {
              locked: false,
              closedAt: null,
              closedPaid: null,
            },
          })

          const activeSessions = await tx.session.findMany({
            where: {
              restaurantId: restaurant.id,
              status: "ACTIVE",
              tagId: {
                in: groupedTagIds,
              },
            },
            orderBy: [
              { openedAt: "asc" },
              { lastActivityAt: "asc" },
              { id: "asc" },
            ],
            select: {
              id: true,
              tableId: true,
              lastActivityAt: true,
            },
          })

          if (activeSessions.length === 0) {
            continue
          }

          const oldestSession = activeSessions[0]
          let masterSessionCart = await tx.sessionCart.findUnique({
            where: { sessionId: oldestSession.id },
            select: { id: true },
          })
          if (!masterSessionCart) {
            masterSessionCart = await tx.sessionCart.create({
              data: {
                sessionId: oldestSession.id,
                restaurantId: restaurant.id,
              },
              select: { id: true },
            })
          }

          const latestActivityAt = activeSessions.reduce(
            (latest, current) =>
              current.lastActivityAt > latest
                ? current.lastActivityAt
                : latest,
            oldestSession.lastActivityAt
          )

          await tx.session.update({
            where: { id: oldestSession.id },
            data: {
              tableId: nextMasterId,
              lastActivityAt: latestActivityAt,
            },
          })

          for (const session of activeSessions.slice(1)) {
            await tx.order.updateMany({
              where: {
                restaurantId: restaurant.id,
                sessionId: session.id,
              },
              data: {
                sessionId: oldestSession.id,
              },
            })

            const childCart = await tx.sessionCart.findUnique({
              where: { sessionId: session.id },
              select: { id: true },
            })
            if (childCart) {
              await tx.cartItem.updateMany({
                where: {
                  restaurantId: restaurant.id,
                  cartId: childCart.id,
                },
                data: {
                  cartId: masterSessionCart.id,
                },
              })

              await tx.sessionCart.delete({
                where: { sessionId: session.id },
              })
            }

            await tx.session.delete({
              where: { id: session.id },
            })
          }
        }

        if (tagsToUnassign.length > 0) {
          await tx.session.updateMany({
            where: {
              restaurantId: restaurant.id,
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
      {
        req,
        restaurantId: restaurant.id,
        tableId: result.masterTableId,
      }
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
