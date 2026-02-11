import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { getEditClientKey } from '@/lib/itemEdits'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const { sessionId, itemId, clientKey } = await req.json()
  if (!sessionId || !itemId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      cart: {
        include: { session: true }
      }
    }
  })
  if (!item || item.cart.sessionId !== sessionId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const requesterClientKey = normalizeClientKey(clientKey)
  const ownerClientKey = getEditClientKey(item.edits)
  if (
    ownerClientKey &&
    ownerClientKey !== requesterClientKey
  ) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  await prisma.cartItem.delete({
    where: { id: itemId }
  })

  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() }
  })

  await appendSystemEvent(
    'item_removed',
    {
      itemId,
      name: item.name
    },
    {
      req,
      sessionId,
      tableId: item.cart.session.tableId
    }
  )

  return NextResponse.json({ removed: true })
}
