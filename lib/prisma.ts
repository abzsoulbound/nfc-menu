import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  return trimmed === "" ? undefined : trimmed
}

function createPrismaClient() {
  const databaseUrl = resolveDatabaseUrl()
  return new PrismaClient({
    log: ["error"],
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
  })
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getPrismaClient(), prop, value, receiver)
  },
}) as PrismaClient
