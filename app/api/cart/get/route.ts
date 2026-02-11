import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import {
  getEditClientKey,
  isEditConfirmed,
  stripInternalEditMeta,
} from '@/lib/itemEdits'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? '')
  const requesterClientKey = normalizeClientKey(
    body?.clientKey
  )

  if (!sessionId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
    include: {
      items: true,
      session: true
    }
  })

  if (!cart) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  const previousLastActivityAt = cart.session.lastActivityAt
  const touchedAt = new Date()
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: touchedAt }
  })

  const stale =
    Date.now() - previousLastActivityAt.getTime() >
    SESSION_IDLE_TIMEOUT_MS

  const items = cart.items.map(item => {
    const ownerClientKey = getEditClientKey(item.edits)
    const confirmed = isEditConfirmed(item.edits)
    const isMine = Boolean(
      requesterClientKey &&
        ownerClientKey &&
        requesterClientKey === ownerClientKey
    )

    return {
      ...item,
      edits: stripInternalEditMeta(item.edits),
      ownerClientKey,
      confirmed,
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
      })
      continue
    }

    existing.itemCount += 1
    existing.quantity += item.quantity
    existing.confirmed = existing.confirmed && item.confirmed
  }

  const members = Array.from(membersByClient.values())
  const requesterMember = members.find(member => member.isMine)
  const requesterHasItems = Boolean(requesterMember)
  const requesterConfirmed = requesterMember
    ? requesterMember.confirmed
    : true
  const allMembersConfirmed =
    members.length === 0
      ? true
      : members.every(member => member.confirmed)
  const unconfirmedMemberCount = members.filter(
    member => !member.confirmed
  ).length

  return NextResponse.json({
    id: cart.id,
    sessionId: cart.sessionId,
    items,
    members,
    confirmation: {
      requesterHasItems,
      requesterConfirmed,
      allMembersConfirmed,
      unconfirmedMemberCount,
      totalMemberCount: members.length,
      confirmedMemberCount:
        members.length - unconfirmedMemberCount,
    },
    session: {
      status: cart.session.status.toLowerCase(),
      openedAt: cart.session.openedAt.toISOString(),
      lastActivityAt: touchedAt.toISOString(),
      stale
    }
  })
}
