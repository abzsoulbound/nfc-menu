import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { getTableGroupByTableNo } from "@/lib/tableGroups"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

type BillingLineItem = {
  orderId: string
  orderItemId: string
  sessionId: string
  tagId: string
  name: string
  quantity: number
  unitPrice: number
  vatRate: number
  status: string
  submittedAt: string
  lineTotal: number
  vatAmount: number
}

type BillingTotals = {
  subtotal: number
  vat: number
  total: number
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100
}

function toCents(value: number) {
  return Math.round(value * 100)
}

function toVatAmount(lineTotal: number, vatRate: number) {
  if (!Number.isFinite(vatRate) || vatRate <= 0) return 0
  return lineTotal - lineTotal / (1 + vatRate)
}

function toBillingLineItems(orders: Array<{
  id: string
  sessionId: string
  createdAt: Date
  session: { tagId: string }
  items: Array<{
    id: string
    name: string
    quantity: number
    unitPrice: number
    vatRate: number
    status: string
  }>
}>): BillingLineItem[] {
  return orders.flatMap(order =>
    order.items.map(item => {
      const lineTotal = Number(item.unitPrice) * Number(item.quantity)
      const vatAmount = toVatAmount(lineTotal, Number(item.vatRate))
      return {
        orderId: order.id,
        orderItemId: item.id,
        sessionId: order.sessionId,
        tagId: order.session.tagId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
        status: item.status.toLowerCase(),
        submittedAt: order.createdAt.toISOString(),
        lineTotal: toMoney(lineTotal),
        vatAmount: toMoney(vatAmount),
      }
    })
  )
}

function summarize(items: BillingLineItem[]) {
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const vat = items.reduce((sum, item) => sum + item.vatAmount, 0)
  return {
    subtotal: toMoney(total - vat),
    vat: toMoney(vat),
    total: toMoney(total),
  }
}

function totalsFromCents(
  totalCents: number,
  vatCents: number
): BillingTotals {
  const subtotalCents = totalCents - vatCents
  return {
    subtotal: toMoney(subtotalCents / 100),
    vat: toMoney(vatCents / 100),
    total: toMoney(totalCents / 100),
  }
}

export async function GET(req: Request) {
  try {
    await requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const { searchParams } = new URL(req.url)
  const tableNumber = Number(searchParams.get("tableNumber"))
  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const tableGroup = await getTableGroupByTableNo(
    tableNumber,
    restaurant.id
  )
  if (!tableGroup) {
    return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 })
  }
  const tableIds = tableGroup.assignments.map(assignment => assignment.id)

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: restaurant.id,
      tableId: { in: tableIds },
      status: {
        in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      session: {
        select: {
          tagId: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        where: {
          restaurantId: restaurant.id,
          status: {
            in: ["PENDING", "IN_PROGRESS", "COMPLETED"],
          },
        },
      },
    },
  })

  const lineItems = toBillingLineItems(orders)
  const totals = summarize(lineItems)

  const devicesMap = new Map<
    string,
    {
      sessionId: string
      tagId: string
      itemCount: number
      totalCents: number
      vatCents: number
    }
  >()

  for (const item of lineItems) {
    const lineTotalCents = toCents(item.lineTotal)
    const lineVatCents = toCents(item.vatAmount)
    const existing = devicesMap.get(item.sessionId) ?? {
      sessionId: item.sessionId,
      tagId: item.tagId,
      itemCount: 0,
      totalCents: 0,
      vatCents: 0,
    }

    existing.itemCount += item.quantity
    existing.totalCents += lineTotalCents
    existing.vatCents += lineVatCents

    devicesMap.set(item.sessionId, existing)
  }

  const devices = Array.from(devicesMap.values())
    .map(device => ({
      sessionId: device.sessionId,
      tagId: device.tagId,
      itemCount: device.itemCount,
      totals: totalsFromCents(
        device.totalCents,
        device.vatCents
      ),
    }))
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId))

  return NextResponse.json({
    tableNumber,
    masterTableId: tableGroup.master.id,
    groupedTableIds: tableIds,
    totals,
    lineItems,
    devices,
    generatedAt: new Date().toISOString(),
  })
}
