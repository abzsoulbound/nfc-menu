export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import {
  ASSIST_EDIT_UNLOCK_MS,
  MEMBER_INACTIVE_MS,
  SESSION_IDLE_TIMEOUT_MS,
  UNCONFIRMED_ITEM_EXPIRY_MS,
} from '@/lib/constants'
import {
  getEditClientKey,
  isEditConfirmed,
  getEditHardActivityAt,
  stripInternalEditMeta,
} from '@/lib/itemEdits'
import { appendSystemEvent } from '@/lib/events'
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from '@/lib/api/withTenant'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isDbOutOfMemoryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('code: "53200"') ||
    message.includes("code: '53200'") ||
    message.includes('out of memory')
  )
}

const cartGetHitWindowBySession = new Map<string, number[]>()
const cartGetInFlightBySession = new Map<string, Promise<Response>>()
const CART_GET_RATE_LIMIT_WINDOW_MS = Number.isFinite(
  Number(process.env.CART_GET_RATE_LIMIT_WINDOW_MS)
)
  ? Math.max(1, Number(process.env.CART_GET_RATE_LIMIT_WINDOW_MS))
  : 10_000
const CART_GET_RATE_LIMIT_MAX = Number.isFinite(
  Number(process.env.CART_GET_RATE_LIMIT_MAX)
)
  ? Math.max(1, Number(process.env.CART_GET_RATE_LIMIT_MAX))
  : 20

function enforceRateLimit(sessionId: string, requestId: string): boolean {
  const now = Date.now()
  const windowMs = CART_GET_RATE_LIMIT_WINDOW_MS
  const maxHits = CART_GET_RATE_LIMIT_MAX
  
  const existing = cartGetHitWindowBySession.get(sessionId) ?? []
  const next = existing.filter(ts => now - ts <= windowMs)
  
  if (next.length >= maxHits) {
    console.warn('cart_get_rate_limit_exceeded', {
      sessionId,
      requestId,
      count: next.length,
      windowMs,
      action: 'reject_429',
    })
    return false
  }
  
  next.push(now)
  cartGetHitWindowBySession.set(sessionId, next)

  // Cleanup old entries
  if (cartGetHitWindowBySession.size > 5000) {
    for (const [key, hits] of cartGetHitWindowBySession) {
      const trimmed = hits.filter(ts => now - ts <= windowMs)
      if (trimmed.length === 0) {
        cartGetHitWindowBySession.delete(key)
      } else {
        cartGetHitWindowBySession.set(key, trimmed)
      }
      if (cartGetHitWindowBySession.size <= 2500) {
        break
      }
    }
  }
  
  return true
}

export async function POST(req: Request) {
  return withTenant(
    req,
    async ({ requestId, restaurant }) => {
      const SESSION_TOUCH_THROTTLE_MS = 60000
      let body: unknown
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
      const sessionId = String(payload.sessionId ?? '')
      const requesterClientKey = normalizeClientKey(
        payload.clientKey
      )

      if (!sessionId) {
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Session ID is required.',
        })
      }

      // IN-FLIGHT DEDUPLICATION: collapse concurrent requests for same session
      const existingPromise = cartGetInFlightBySession.get(sessionId)
      if (existingPromise) {
        console.log('cart_get_dedupe_hit', { sessionId, requestId })
        return existingPromise.then(response => response.clone())
      }

      if (!enforceRateLimit(sessionId, requestId)) {
        return apiErrorResponse({
          requestId,
          error: 'RATE_LIMITED',
          status: 429,
          message: 'Too many basket refresh requests. Please wait a moment.',
        })
      }

      // Create promise for this request
      const responsePromise = (async (): Promise<Response> => {
        try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            restaurantId: true,
            status: true,
            openedAt: true,
            lastActivityAt: true,
            tableId: true,
          },
        })

        if (!session || session.restaurantId !== restaurant.id) {
          return apiErrorResponse({
            requestId,
            error: 'SESSION_NOT_FOUND',
            status: 404,
          })
        }

        const cart = await prisma.sessionCart.findUnique({
          where: {
            sessionId,
          },
          select: {
            id: true,
            sessionId: true,
            restaurantId: true,
            items: {
              select: {
                id: true,
                menuItemId: true,
                name: true,
                quantity: true,
                unitPrice: true,
                vatRate: true,
                allergens: true,
                station: true,
                edits: true,
                updatedAt: true,
              },
            },
          },
        })

        if (!cart || cart.restaurantId !== restaurant.id) {
          return apiErrorResponse({
            requestId,
            error: 'SESSION_NOT_FOUND',
            status: 404,
          })
        }

        const previousLastActivityAt = session.lastActivityAt
        const now = new Date()
        const shouldTouch =
          now.getTime() - previousLastActivityAt.getTime() >=
          SESSION_TOUCH_THROTTLE_MS
        const touchedAt = shouldTouch
          ? now
          : previousLastActivityAt

        if (shouldTouch) {
          await prisma.session.update({
            where: { id: sessionId },
            data: { lastActivityAt: now },
          })
        }

        const stale =
          Date.now() - previousLastActivityAt.getTime() >
          SESSION_IDLE_TIMEOUT_MS
        const nowMs = Date.now()

        const expiredUnconfirmedItemIds = cart.items
          .filter(item => {
            const ownerClientKey = getEditClientKey(item.edits)
            if (!ownerClientKey) return false
            if (isEditConfirmed(item.edits)) return false

            const hardActivityAt =
              getEditHardActivityAt(item.edits) ??
              item.updatedAt.toISOString()
            const idleForMs =
              nowMs - new Date(hardActivityAt).getTime()
            return idleForMs >= UNCONFIRMED_ITEM_EXPIRY_MS
          })
          .map(item => item.id)

        let activeCartItems = cart.items
        if (expiredUnconfirmedItemIds.length > 0) {
          await prisma.cartItem.deleteMany({
            where: {
              restaurantId: restaurant.id,
              cartId: cart.id,
              id: { in: expiredUnconfirmedItemIds },
            },
          })
          const expiredIdSet = new Set(expiredUnconfirmedItemIds)
          activeCartItems = cart.items.filter(
            item => !expiredIdSet.has(item.id)
          )

          await appendSystemEvent(
            'member_items_expired',
            {
              sessionId,
              itemCount: expiredUnconfirmedItemIds.length,
            },
            {
              req,
              restaurantId: restaurant.id,
              sessionId,
              tableId: session.tableId,
            }
          )
        }

        const items = activeCartItems.map(item => {
          const ownerClientKey = getEditClientKey(item.edits)
          const confirmed = isEditConfirmed(item.edits)
          const hardActivityAt =
            getEditHardActivityAt(item.edits) ??
            item.updatedAt.toISOString()
          const hardActivityMs = new Date(hardActivityAt).getTime()
          const inactive =
            nowMs - hardActivityMs >= MEMBER_INACTIVE_MS
          const assistUnlocked =
            nowMs - hardActivityMs >= ASSIST_EDIT_UNLOCK_MS
          const isMine = Boolean(
            requesterClientKey &&
              ownerClientKey &&
              requesterClientKey === ownerClientKey
          )
          const canRequesterEdit = Boolean(
            requesterClientKey &&
              (
                !ownerClientKey ||
                requesterClientKey === ownerClientKey ||
                assistUnlocked
              )
          )

          return {
            id: item.id,
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            allergens: item.allergens,
            station: item.station,
            edits: stripInternalEditMeta(item.edits),
            ownerClientKey,
            confirmed,
            hardActivityAt,
            inactive,
            canRequesterEdit,
            isMine,
          }
        })

        const membersByClient = new Map<
          string,
          {
            clientKey: string
            itemCount: number
            quantity: number
            confirmed: boolean
            isMine: boolean
            hardActivityAt: string
            inactive: boolean
          }
        >()

        for (const item of items) {
          if (!item.ownerClientKey) continue

          const existing = membersByClient.get(item.ownerClientKey)
          if (!existing) {
            membersByClient.set(item.ownerClientKey, {
              clientKey: item.ownerClientKey,
              itemCount: 1,
              quantity: item.quantity,
              confirmed: item.confirmed,
              isMine: item.isMine,
              hardActivityAt: item.hardActivityAt,
              inactive: item.inactive,
            })
            continue
          }

          existing.itemCount += 1
          existing.quantity += item.quantity
          existing.confirmed = existing.confirmed && item.confirmed
          if (
            new Date(item.hardActivityAt).getTime() >
            new Date(existing.hardActivityAt).getTime()
          ) {
            existing.hardActivityAt = item.hardActivityAt
          }
          existing.inactive =
            nowMs - new Date(existing.hardActivityAt).getTime() >=
            MEMBER_INACTIVE_MS
        }

        const members = Array.from(membersByClient.values())
        const activeMembers = members.filter(member => !member.inactive)
        const requesterMember = members.find(member => member.isMine)
        const requesterHasItems = Boolean(requesterMember)
        const requesterConfirmed = requesterMember
          ? requesterMember.confirmed
          : true
        const allMembersConfirmed =
          activeMembers.length === 0
            ? true
            : activeMembers.every(member => member.confirmed)
        const unconfirmedMemberCount = activeMembers.filter(
          member => !member.confirmed
        ).length

        return jsonWithTenantRequestId(
          {
            id: cart.id,
            sessionId: cart.sessionId,
            items,
            members,
            confirmation: {
              requesterHasItems,
              requesterConfirmed,
              allMembersConfirmed,
              unconfirmedMemberCount,
              totalMemberCount: activeMembers.length,
              inactiveMemberCount: members.length - activeMembers.length,
              confirmedMemberCount:
                activeMembers.length - unconfirmedMemberCount,
            },
            session: {
              status: session.status.toLowerCase(),
              openedAt: session.openedAt.toISOString(),
              lastActivityAt: touchedAt.toISOString(),
              stale,
            },
          },
          requestId
        )
        } catch (error) {
          if (isDbOutOfMemoryError(error)) {
            console.error('cart_get_db_oom', {
              requestId,
              restaurantId: restaurant.id,
              sessionId,
            })

            return apiErrorResponse({
              requestId,
              error: 'SERVICE_TEMPORARILY_UNAVAILABLE',
              status: 503,
              message: 'Service temporarily overloaded. Please retry.',
            })
          }

          throw error
        }
      })()

      // Store promise and cleanup after completion
      cartGetInFlightBySession.set(sessionId, responsePromise)
      responsePromise.finally(() => {
        cartGetInFlightBySession.delete(sessionId)
      })

      return responsePromise
    },
    {}
  )
}
