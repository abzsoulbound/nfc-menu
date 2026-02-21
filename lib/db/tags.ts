import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type DbClient = {
  nfcTag: {
    findUnique: (...args: any[]) => Promise<any>
    findFirst: (...args: any[]) => Promise<any>
    create: (...args: any[]) => Promise<any>
  }
}

function dbClient(client?: DbClient) {
  return client ?? prisma
}

export function normalizeTagToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  const compact = trimmed.replace(/[\s_]+/g, "-")
  const collapsed = compact.replace(/-+/g, "-").replace(/^-|-$/g, "")

  if (/^\d+$/.test(collapsed)) {
    const numeric = collapsed.replace(/^0+(?=\d)/, "")
    return numeric.length > 0 ? numeric : "0"
  }

  return collapsed.toUpperCase()
}

function tagTokenCandidates(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const normalized = normalizeTagToken(trimmed)
  const compact = trimmed.replace(/[\s_-]+/g, "")

  const variants = [
    trimmed,
    normalized,
    trimmed.toUpperCase(),
    trimmed.toLowerCase(),
    compact,
    compact.toUpperCase(),
    compact.toLowerCase(),
  ].filter(Boolean)

  if (/^\d+$/.test(trimmed)) {
    variants.push(trimmed.replace(/^0+(?=\d)/, "") || "0")
  }
  if (/^\d+$/.test(normalized)) {
    variants.push(normalized.replace(/^0+(?=\d)/, "") || "0")
  }

  return Array.from(new Set(variants))
}

export async function findTagByToken(input: {
  restaurantId: string
  tagId: string
  client?: DbClient
}) {
  const database = dbClient(input.client)
  const candidates = tagTokenCandidates(input.tagId)
  if (candidates.length === 0) return null

  if (candidates.length === 1) {
    return database.nfcTag.findUnique({
      where: {
        restaurantId_tagId: {
          restaurantId: input.restaurantId,
          tagId: candidates[0],
        },
      },
    })
  }

  return database.nfcTag.findFirst({
    where: {
      restaurantId: input.restaurantId,
      tagId: { in: candidates },
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function resolveCanonicalTagId(input: {
  restaurantId: string
  tagId: string
  client?: DbClient
}) {
  const existing = await findTagByToken(input)
  if (existing) return existing.tagId
  return normalizeTagToken(input.tagId)
}

export async function ensureTagByToken(input: {
  restaurantId: string
  tagId: string
  client?: DbClient
}) {
  const existing = await findTagByToken(input)
  if (existing) return existing

  const canonicalTagId = normalizeTagToken(input.tagId)
  if (!canonicalTagId) {
    throw new Error("INVALID_TAG_ID")
  }

  try {
    return await dbClient(input.client).nfcTag.create({
      data: {
        restaurantId: input.restaurantId,
        tagId: canonicalTagId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Another request created the tag first; read it back.
      const created = await findTagByToken({
        restaurantId: input.restaurantId,
        tagId: canonicalTagId,
        client: input.client,
      })
      if (created) return created
    }
    throw error
  }
}
