import { PrismaClient } from "@prisma/client"

let client: PrismaClient | null = null

export function initDb() {
  if (!client) {
    client = new PrismaClient()
  }
  return client
}