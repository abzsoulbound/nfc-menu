#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client")

function maskConnectionUrl(raw) {
  try {
    const url = new URL(raw)
    if (url.password) {
      url.password = "****"
    }
    return url.toString()
  } catch {
    return "(unparseable DATABASE_URL)"
  }
}

function formatError(error) {
  if (!error) return "unknown error"
  if (typeof error.message === "string") return error.message
  return String(error)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is missing.")
    process.exit(1)
  }

  console.log(`Checking DB connection: ${maskConnectionUrl(databaseUrl)}`)

  const prisma = new PrismaClient()
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    console.error(`Connection failed: ${formatError(error)}`)
    process.exit(1)
  }

  try {
    const [tagCount, tableCount, sessionCount, menuCount] = await Promise.all([
      prisma.nfcTag.count(),
      prisma.tableAssignment.count(),
      prisma.session.count(),
      prisma.menuItem.count(),
    ])

    const duration = Date.now() - startedAt
    console.log("DB is reachable and schema is readable.")
    console.log(
      `Counts: tags=${tagCount}, tables=${tableCount}, sessions=${sessionCount}, menuItems=${menuCount}`
    )
    console.log(`Round-trip: ${duration}ms`)
  } catch (error) {
    console.error(
      "DB connected, but app tables are not ready. Run: npm run prisma:migrate:deploy"
    )
    console.error(`Details: ${formatError(error)}`)
    process.exit(2)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(`Unexpected failure: ${formatError(error)}`)
  process.exit(1)
})
