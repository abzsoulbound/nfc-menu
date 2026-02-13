import { prisma } from "@/lib/prisma"

type DbClient = {
  nfcTag: {
    findUnique: (...args: any[]) => Promise<any>
    create: (...args: any[]) => Promise<any>
  }
}

function dbClient(client?: DbClient) {
  return client ?? prisma
}

export async function findTagByToken(input: {
  restaurantId: string
  tagId: string
  client?: DbClient
}) {
  return dbClient(input.client).nfcTag.findUnique({
    where: {
      restaurantId_tagId: {
        restaurantId: input.restaurantId,
        tagId: input.tagId,
      },
    },
  })
}

export async function ensureTagByToken(input: {
  restaurantId: string
  tagId: string
  client?: DbClient
}) {
  const existing = await findTagByToken(input)
  if (existing) return existing

  return dbClient(input.client).nfcTag.create({
    data: {
      restaurantId: input.restaurantId,
      tagId: input.tagId,
    },
  })
}
