import { prisma } from "@/lib/prisma"
import { normalizeTagToken } from "@/lib/db/tags"

// Reserved high table number for till/takeaway traffic.
export const TAKEAWAY_TILL_TABLE_NO = 9900

function canonicalTag(tagId: string) {
  return normalizeTagToken(tagId)
}

export function isTakeawayTillTag(tagId: string) {
  const canonical = canonicalTag(tagId)
  if (!canonical) return false

  return (
    canonical === "TILL" ||
    canonical === "TAKEAWAY" ||
    canonical.startsWith("TILL-") ||
    canonical.startsWith("TAKEAWAY-")
  )
}

export async function ensureTakeawayTillAssignment(input: {
  restaurantId: string
  nfcTagId: string
  tagId: string
}) {
  const canonical = canonicalTag(input.tagId)
  if (!canonical || !isTakeawayTillTag(canonical)) {
    return null
  }

  const existing = await prisma.tableAssignment.findUnique({
    where: {
      restaurantId_tagId: {
        restaurantId: input.restaurantId,
        tagId: canonical,
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

  if (existing) {
    if (
      existing.locked ||
      existing.closedAt !== null ||
      existing.closedPaid !== null
    ) {
      return prisma.tableAssignment.update({
        where: { id: existing.id },
        data: {
          locked: false,
          closedAt: null,
          closedPaid: null,
        },
        select: {
          id: true,
          tableNo: true,
        },
      })
    }
    return existing
  }

  return prisma.tableAssignment.create({
    data: {
      restaurantId: input.restaurantId,
      nfcTagId: input.nfcTagId,
      tagId: canonical,
      tableNo: TAKEAWAY_TILL_TABLE_NO,
      locked: false,
      closedAt: null,
      closedPaid: null,
    },
    select: {
      id: true,
      tableNo: true,
    },
  })
}
