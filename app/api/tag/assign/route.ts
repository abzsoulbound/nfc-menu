import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { appendSystemEvent } from '@/lib/events'
import { getTableGroupByTableNo } from '@/lib/tableGroups'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

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
    select: { id: true, restaurantId: true }
  })
  if (!tag || tag.restaurantId !== restaurant.id) {
    return NextResponse.json(
      { error: 'TAG_NOT_REGISTERED' },
      { status: 404 }
    )
  }

  const previousAssignment = await prisma.tableAssignment.findFirst({
    where: {
      tagId,
      restaurantId: restaurant.id,
    },
    select: { tableNo: true }
  })

  const assignment = await prisma.tableAssignment.upsert({
    where: { tagId },
    update: {
      restaurantId: restaurant.id,
      tableNo,
    },
    create: {
      restaurantId: restaurant.id,
      tagId,
      tableNo,
    }
  })
  const tableGroup = await getTableGroupByTableNo(
    tableNo,
    restaurant.id
  )
  const masterTableId = tableGroup?.master.id ?? assignment.id

  await prisma.session.updateMany({
    where: {
      restaurantId: restaurant.id,
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
      previousAssignment.tableNo,
      restaurant.id
    )
    if (previousGroup) {
      const previousGroupTagIds = previousGroup.assignments.map(
        groupAssignment => groupAssignment.tagId
      )
      await prisma.session.updateMany({
        where: {
          restaurantId: restaurant.id,
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
      restaurantId: restaurant.id,
      tableId: masterTableId
    }
  )

  return NextResponse.json(assignment)
}
