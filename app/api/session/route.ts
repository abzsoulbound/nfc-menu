export const runtime = 'nodejs'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import { appendSystemEvent } from '@/lib/events'
import { ensureTagByToken, normalizeTagToken } from '@/lib/db/tags'
import { getTableGroupByTableNo } from '@/lib/tableGroups'
import { ensureOrderingTableAssignment } from '@/lib/orderingTableAssignments'
import {
  isTakeawayTillTag,
  TAKEAWAY_TILL_TABLE_NO,
} from '@/lib/tillTags'
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from '@/lib/api/withTenant'

function takeawayTillSessionWhere(
  restaurantId: string
): Prisma.SessionWhereInput {
  return {
    restaurantId,
    status: 'ACTIVE',
    OR: [
      { tagId: 'TILL' },
      { tagId: 'TAKEAWAY' },
      { tagId: { startsWith: 'TILL-' } },
      { tagId: { startsWith: 'TAKEAWAY-' } },
    ],
  }
}

export async function POST(req: Request) {
  return withTenant(req, async ({ requestId, restaurant }) => {
    let body: unknown
    let tagId = ''

    // Timeout protection: abort if request takes too long
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), 25000) // 25s timeout

    try {
      try {
        body = await req.json()
      } catch {
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Invalid JSON request body.',
        })
      }

      const payload =
        body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : {}
      tagId =
        typeof payload.tagId === 'string'
          ? payload.tagId.trim()
          : ''

      if (tagId.length > 128 || !tagId) {
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Tag ID is required.',
        })
      }
      if (!normalizeTagToken(tagId)) {
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Tag ID is invalid.',
        })
      }

      const tag = await ensureTagByToken({
        restaurantId: restaurant.id,
        tagId,
      })

      const isTakeawayOrTill = isTakeawayTillTag(tag.tagId)
      const assignment = await ensureOrderingTableAssignment({
        restaurantId: restaurant.id,
        nfcTagId: tag.id,
        tagId: tag.tagId,
      })
      const resolvedTableGroup = assignment
        ? await getTableGroupByTableNo(
            assignment.tableNo,
            restaurant.id
          )
        : null
      const groupedTableIds = resolvedTableGroup
        ? resolvedTableGroup.assignments.map(
            groupAssignment => groupAssignment.id
          )
        : assignment
        ? [assignment.id]
        : []
      const masterTableId = resolvedTableGroup?.master.id ?? assignment?.id ?? null
      const tableNumber = resolvedTableGroup
        ? resolvedTableGroup.tableNo
        : isTakeawayOrTill
        ? TAKEAWAY_TILL_TABLE_NO
        : null

      const existingWhere: Prisma.SessionWhereInput = resolvedTableGroup
        ? {
            restaurantId: restaurant.id,
            status: 'ACTIVE',
            tableId: {
              in: groupedTableIds,
            },
          }
        : isTakeawayOrTill
        ? takeawayTillSessionWhere(restaurant.id)
        : {
            tagId: tag.tagId,
            restaurantId: restaurant.id,
            status: 'ACTIVE',
          }

      const existing = await prisma.session.findFirst({
        where: existingWhere,
        orderBy: { lastActivityAt: 'desc' },
        include: { cart: true },
      })

      const isStale = (session: { lastActivityAt: Date }) =>
        Date.now() - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_MS

      if (existing && !isStale(existing)) {
        if (!existing.cart) {
          await prisma.sessionCart.create({
            data: {
              sessionId: existing.id,
              restaurantId: restaurant.id,
            },
          })
        }

        const resumed = await prisma.session.update({
          where: { id: existing.id },
          data: {
            lastActivityAt: new Date(),
            tableId: masterTableId,
          },
        })

        await appendSystemEvent(
          'session_reused_for_tag',
          { sessionId: resumed.id, tagId },
          {
            req,
            restaurantId: restaurant.id,
            sessionId: resumed.id,
            tableId: resumed.tableId,
          }
        )

        return jsonWithTenantRequestId(
          {
            sessionId: resumed.id,
            id: resumed.id,
            status: resumed.status.toLowerCase(),
            tableId: resumed.tableId,
            tableNumber,
          },
          requestId
        )
      }

      if (existing && isStale(existing)) {
        await prisma.session.update({
          where: { id: existing.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
          },
        })

        await appendSystemEvent(
          'session_closed_stale',
          { sessionId: existing.id, tagId },
          {
            req,
            restaurantId: restaurant.id,
            sessionId: existing.id,
            tableId: existing.tableId,
          }
        )
      }

      const session = await prisma.session.create({
        data: {
          restaurantId: restaurant.id,
          nfcTagId: tag.id,
          tagId: tag.tagId,
          tableId: masterTableId,
          status: 'ACTIVE',
          openedAt: new Date(),
          lastActivityAt: new Date(),
        },
      })

      await prisma.sessionCart.create({
        data: {
          sessionId: session.id,
          restaurantId: restaurant.id,
        },
      })

      await appendSystemEvent(
        'session_created',
        { sessionId: session.id, tagId },
        {
          req,
          restaurantId: restaurant.id,
          sessionId: session.id,
          tableId: session.tableId,
        }
      )

      return jsonWithTenantRequestId(
        {
          sessionId: session.id,
          id: session.id,
          tableId: session.tableId,
          tableNumber,
        },
        requestId
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('session_post_timeout', {
          requestId,
          tagId,
          restaurantId: restaurant.id,
          error: 'request_timeout_25s',
        })
        return apiErrorResponse({
          requestId,
          error: 'SESSION_CREATE_TIMEOUT',
          status: 504,
          message: 'Request timeout. Please retry.',
        })
      }
      console.error('session_post_failed', {
        requestId,
        tagId,
        restaurantId: restaurant.id,
        error: err instanceof Error ? err.message : 'unknown_error',
      })
      return apiErrorResponse({
        requestId,
        error: 'SESSION_CREATE_FAILED',
        status: 503,
        message: 'Session creation failed. Please retry.',
      })
    } finally {
      clearTimeout(timeoutHandle)
    }
  })
}
