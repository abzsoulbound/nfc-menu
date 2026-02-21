import { prisma } from "@/lib/prisma"
import { normalizeTagToken } from "@/lib/db/tags"

export async function ensureOrderingTableAssignment(input: {
  restaurantId: string
  nfcTagId: string
  tagId: string
}) {
  const canonicalTagId = normalizeTagToken(input.tagId)
  if (!canonicalTagId) return null

  return prisma.tableAssignment.findUnique({
    where: {
      restaurantId_tagId: {
        restaurantId: input.restaurantId,
        tagId: canonicalTagId,
      },
    },
    select: {
      id: true,
      tableNo: true,
      locked: true,
      closedAt: true,
      closedPaid: true,
    },
  })
}
