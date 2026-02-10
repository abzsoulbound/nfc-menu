import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tableId } = await req.json()

  const drafts = await prisma.tableDraft.findMany({
    where: { tableId },
    include: { items: true }
  })

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'NO_DRAFTS' }, { status: 400 })
  }

  const ticket = await prisma.kitchenTicket.create({
    data: {
      tableId,
      items: {
        create: drafts.flatMap(d =>
          d.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            station: 'kitchen'
          }))
        )
      }
    }
  })

  await prisma.draftItem.deleteMany({
    where: { draftId: { in: drafts.map(d => d.id) } }
  })

  await prisma.tableDraft.deleteMany({
    where: { tableId }
  })

  return NextResponse.json({ ticketId: ticket.id })
}
