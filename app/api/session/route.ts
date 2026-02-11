import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/constants'
import { appendSystemEvent } from '@/lib/events'

export async function POST(req: Request) {
  const { tagId } = await req.json()
  if (!tagId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    select: { id: true }
  })
  if (!tag) {
    await prisma.nfcTag.create({
      data: { id: tagId }
    })
  }

  const resolvedTag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    include: { assignment: true }
  })

  if (resolvedTag?.assignment?.closedAt) {
    return NextResponse.json({ error: 'TABLE_CLOSED' }, { status: 409 })
  }

  const existing = await prisma.session.findFirst({
    where: {
      tagId,
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
        data: { sessionId: existing.id }
      })
    }

    const resumed = await prisma.session.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        tableId: existing.tableId ?? resolvedTag?.assignment?.id ?? null
      }
    })

    await appendSystemEvent(
      'session_reused_for_tag',
      { sessionId: resumed.id, tagId },
      { req, sessionId: resumed.id, tableId: resumed.tableId }
    )

    return NextResponse.json({
      sessionId: resumed.id,
      id: resumed.id,
      status: resumed.status.toLowerCase(),
      tableId: resumed.tableId
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
      { req, sessionId: existing.id, tableId: existing.tableId }
    )
  }

  const session = await prisma.session.create({
    data: {
      tagId,
      tableId: resolvedTag?.assignment?.id ?? null,
      status: 'ACTIVE',
      openedAt: new Date(),
      lastActivityAt: new Date()
    }
  })

  await prisma.sessionCart.create({
    data: { sessionId: session.id }
  })

  await appendSystemEvent(
    'session_created',
    { sessionId: session.id, tagId },
    { req, sessionId: session.id, tableId: session.tableId }
  )

  return NextResponse.json({ sessionId: session.id, id: session.id })
}
