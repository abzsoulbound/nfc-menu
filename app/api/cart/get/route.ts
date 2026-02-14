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

export async function POST(req: Request) {
  return withTenant(
    req,
    async ({ requestId, restaurant }) => {
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

      const cart = await prisma.sessionCart.findFirst({
        where: {
          sessionId,
          restaurantId: restaurant.id,
        },
        include: {
          items: true,
          session: true,
        },
      })

      if (!cart) {
        return apiErrorResponse({
          requestId,
          error: 'SESSION_NOT_FOUND',
          status: 404,
        })
      }

      const previousLastActivityAt = cart.session.lastActivityAt
      const touchedAt = new Date()
      await prisma.session.updateMany({
        where: {
          id: sessionId,
          restaurantId: restaurant.id,
        },
        data: { lastActivityAt: touchedAt },
      })

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
            tableId: cart.session.tableId,
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
          ...item,
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
            status: cart.session.status.toLowerCase(),
            openedAt: cart.session.openedAt.toISOString(),
            lastActivityAt: touchedAt.toISOString(),
            stale,
          },
        },
        requestId
      )
    },
    {}
  )
}
