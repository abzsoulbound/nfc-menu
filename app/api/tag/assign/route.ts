import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { appendSystemEvent } from '@/lib/events'
import { getTableGroupByTableNo } from '@/lib/tableGroups'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await req.json()
  const tagId =
    typeof body?.tagId === 'string'
      ? body.tagId.trim()
      : ''
  const tableNo = Number(body?.tableNo)

  if (
    !tagId ||
    tagId.length > 128 ||
    !Number.isInteger(tableNo) ||
    tableNo <= 0
  ) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    select: { id: true }
  })
  if (!tag) {
    return NextResponse.json(
      { error: 'TAG_NOT_REGISTERED' },
      { status: 404 }
    )
  }

  const previousAssignment = await prisma.tableAssignment.findUnique({
    where: { tagId },
    select: { tableNo: true }
  })

  const assignment = await prisma.tableAssignment.upsert({
    where: { tagId },
    update: { tableNo },
    create: { tagId, tableNo }
  })
  const tableGroup = await getTableGroupByTableNo(tableNo)
  const masterTableId = tableGroup?.master.id ?? assignment.id

  await prisma.session.updateMany({
    where: {
      tagId,
      status: 'ACTIVE'
    },
    data: {
      tableId: masterTableId
    }
  })

  if (
    previousAssignment &&
    previousAssignment.tableNo !== tableNo
  ) {
    const previousGroup = await getTableGroupByTableNo(
      previousAssignment.tableNo
    )
    if (previousGroup) {
      const previousGroupTagIds = previousGroup.assignments.map(
        groupAssignment => groupAssignment.tagId
      )
      await prisma.session.updateMany({
        where: {
          tagId: { in: previousGroupTagIds },
          status: 'ACTIVE'
        },
        data: {
          tableId: previousGroup.master.id
        }
      })
    }
  }

  await appendSystemEvent(
    'tag_assigned',
    {
      tagId,
      tableNo,
      tableId: masterTableId
    },
    {
      req,
      tableId: masterTableId
    }
  )

  return NextResponse.json(assignment)
}
