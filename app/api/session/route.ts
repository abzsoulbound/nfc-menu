import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import { appendSystemEvent } from '@/lib/events'
import {
  getTableGroupForTag,
  isTableGroupClosed,
} from '@/lib/tableGroups'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const body = await req.json()
  const tagId =
    typeof body?.tagId === 'string'
      ? body.tagId.trim()
      : ''

  if (tagId.length > 128) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  if (!tagId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    select: { id: true, restaurantId: true }
  })
  if (!tag || tag.restaurantId !== restaurant.id) {
    return NextResponse.json(
      { error: 'TAG_NOT_REGISTERED' },
      { status: 404 }
    )
  }

  const resolvedTag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    include: { assignment: true }
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
    return NextResponse.json({ error: 'TABLE_CLOSED' }, { status: 409 })
  }

  const existing = await prisma.session.findFirst({
    where: {
      tagId,
      restaurantId: restaurant.id,
      status: 'ACTIVE'
    },
    orderBy: { lastActivityAt: 'desc' },
    include: { cart: true }
  })

  const isStale = (session: { lastActivityAt: Date }) =>
    Date.now() - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_MS

  if (existing && !isStale(existing)) {
    if (!existing.cart) {
      await prisma.sessionCart.create({
        data: {
          sessionId: existing.id,
          restaurantId: restaurant.id,
        }
      })
    }

    const resumed = await prisma.session.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        tableId: masterTableId
      }
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

    return NextResponse.json({
      sessionId: resumed.id,
      id: resumed.id,
      status: resumed.status.toLowerCase(),
      tableId: resumed.tableId,
      tableNumber
    })
  }

  if (existing && isStale(existing)) {
    await prisma.session.update({
      where: { id: existing.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
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
      tagId,
      tableId: masterTableId,
      status: 'ACTIVE',
      openedAt: new Date(),
      lastActivityAt: new Date()
    }
  })

  await prisma.sessionCart.create({
    data: {
      sessionId: session.id,
      restaurantId: restaurant.id,
    }
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

  return NextResponse.json({
    sessionId: session.id,
    id: session.id,
    tableId: session.tableId,
    tableNumber
  })
}
