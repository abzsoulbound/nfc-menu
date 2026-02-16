export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import { appendSystemEvent } from '@/lib/events'
import { findTagByToken } from '@/lib/db/tags'
import {
  getTableGroupForTag,
  isTableGroupClosed,
} from '@/lib/tableGroups'
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from '@/lib/api/withTenant'

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

      const tag = await findTagByToken({
        restaurantId: restaurant.id,
        tagId,
      })
      if (!tag) {
        return apiErrorResponse({
          requestId,
          error: 'TAG_NOT_REGISTERED',
          status: 404,
        })
      }

      const resolvedTag = await prisma.nfcTag.findUnique({
        where: { id: tag.id },
        include: { assignment: true },
      })
      const resolvedTableGroup = await getTableGroupForTag(
        tagId,
        restaurant.id
      )
      const masterTableId = resolvedTableGroup?.master.id ?? null
      const tableNumber = resolvedTableGroup?.tableNo ?? null

      if (
        resolvedTag?.assignment?.closedAt ||
        (resolvedTableGroup && isTableGroupClosed(resolvedTableGroup))
      ) {
        return apiErrorResponse({
          requestId,
          error: 'TABLE_CLOSED',
          status: 409,
        })
      }

      const existing = await prisma.session.findFirst({
        where: {
          tagId: tag.tagId,
          restaurantId: restaurant.id,
          status: 'ACTIVE',
        },
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
