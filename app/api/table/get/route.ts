export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import { getTableGroupByAssignmentId } from '@/lib/tableGroups'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const body = await req.json()
  const tableId =
    typeof body?.tableId === 'string'
      ? body.tableId.trim()
      : ''
  const sessionId =
    typeof body?.sessionId === 'string'
      ? body.sessionId.trim()
      : ''

  if (!tableId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  let staffAuthorized = true
  try {
    await requireStaff(req)
  } catch {
    staffAuthorized = false
  }

  if (!staffAuthorized) {
    if (!sessionId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        restaurantId: true,
        tableId: true,
        status: true,
        lastActivityAt: true,
      },
    })
    if (session && session.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    const requestedTableGroup = await getTableGroupByAssignmentId(
      tableId,
      restaurant.id
    )
    if (
      !session ||
      !session.tableId ||
      !requestedTableGroup ||
      !requestedTableGroup.assignments.some(
        assignment => assignment.id === session.tableId
      )
    ) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'SESSION_STALE' },
        { status: 410 }
      )
    }

    const stale =
      Date.now() - session.lastActivityAt.getTime() >
      SESSION_IDLE_TIMEOUT_MS
    if (stale) {
      return NextResponse.json(
        { error: 'SESSION_STALE' },
        { status: 410 }
      )
    }
  }

  const drafts = await prisma.tableDraft.findMany({
    where: {
      tableId,
      restaurantId: restaurant.id,
    },
    include: { items: true }
  })

  return NextResponse.json(drafts)
}
