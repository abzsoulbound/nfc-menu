import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { PrismaClient } from "@prisma/client"

const ROOT = process.cwd()
const DEFAULT_ENV_FILE = ".env.neoncheck.production"

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/prisma-migration-history-reconcile.mjs [--env-file <path>]",
      "",
      "Purpose:",
      "  Reconcile production Prisma migration metadata (_prisma_migrations)",
      "  with local prisma/migrations directories by:",
      "  1) backing up _prisma_migrations to a timestamped table",
      "  2) truncating _prisma_migrations",
      "  3) marking each local migration as applied via prisma migrate resolve",
      "",
      "Default env file:",
      `  ${DEFAULT_ENV_FILE}`,
    ].join("\n")
  )
}

function stripOuterQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`)
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const lines = raw.split(/\r?\n/)
  const env = {}
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eqIndex = line.indexOf("=")
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex).trim()
    const value = stripOuterQuotes(line.slice(eqIndex + 1).trim())
    env[key] = value
  }
  return env
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return process.argv[index + 1]?.trim() ?? ""
}

function resolveEnvFile() {
  const fromFlag = getArgValue("--env-file")
  const fromPositional = process.argv[2]?.startsWith("--")
    ? ""
    : process.argv[2]
  const fromEnv = process.env.QA_ENV_FILE?.trim() ?? ""
  const selected =
    fromFlag ||
    fromPositional ||
    fromEnv ||
    DEFAULT_ENV_FILE
  return path.resolve(ROOT, selected)
}

function listLocalMigrations() {
  const migrationsDir = path.join(ROOT, "prisma", "migrations")
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations dir not found: ${migrationsDir}`)
  }

  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => /^\d{14}_[a-z0-9_]+$/i.test(name))
    .sort()
}

function runPrismaResolve(migrationName, env) {
  return new Promise((resolve, reject) => {
    const prismaCli = path.join(
      ROOT,
      "node_modules",
      "prisma",
      "build",
      "index.js"
    )
    if (!fs.existsSync(prismaCli)) {
      reject(new Error(`Prisma CLI not found: ${prismaCli}`))
      return
    }

    const child = spawn(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "resolve",
        "--applied",
        migrationName,
        "--schema",
        "prisma/schema.prisma",
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
        env,
      }
    )

    child.on("exit", code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `prisma migrate resolve failed for ${migrationName} with exit code ${code ?? -1}`
        )
      )
    })
    child.on("error", reject)
  })
}

function timestampTag() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  const hh = String(now.getUTCHours()).padStart(2, "0")
  const mm = String(now.getUTCMinutes()).padStart(2, "0")
  const ss = String(now.getUTCSeconds()).padStart(2, "0")
  return `${y}${m}${d}${hh}${mm}${ss}`
}

async function main() {
  if (process.argv.includes("--help")) {
    usage()
    process.exit(0)
  }

  const envFile = resolveEnvFile()
  const envValues = parseEnvFile(envFile)
  const databaseUrl = String(envValues.DATABASE_URL ?? "").trim()
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is missing in env file: ${envFile}`
    )
  }

  const localMigrations = listLocalMigrations()
  if (localMigrations.length === 0) {
    throw new Error("No local migrations found in prisma/migrations")
  }

  const commandEnv = {
    ...process.env,
    ...envValues,
    DATABASE_URL: databaseUrl,
  }

  console.log(`[migrate-reconcile] ENV_FILE=${envFile}`)
  console.log(
    `[migrate-reconcile] Local migrations: ${localMigrations.length}`
  )

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  const backupTable = `_prisma_migrations_backup_${timestampTag()}`

  try {
    const before = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`
    )
    const beforeCount = Number(before?.[0]?.count ?? 0)

    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${backupTable}" AS TABLE "_prisma_migrations"`
    )
    console.log(
      `[migrate-reconcile] Backup created: ${backupTable} (${beforeCount} rows)`
    )

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "_prisma_migrations"`)
    console.log("[migrate-reconcile] Truncated _prisma_migrations")
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  for (const migrationName of localMigrations) {
    console.log(`[migrate-reconcile] Marking applied: ${migrationName}`)
    // Resolve records metadata only; does not run migration SQL.
    await runPrismaResolve(migrationName, commandEnv)
  }

  const verifyPrisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
  try {
    const after = await verifyPrisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`
    )
    const afterCount = Number(after?.[0]?.count ?? 0)
    console.log(
      `[migrate-reconcile] Completed. _prisma_migrations rows: ${afterCount}`
    )
    console.log(
      `[migrate-reconcile] Backup table retained: ${backupTable}`
    )
  } finally {
    await verifyPrisma.$disconnect().catch(() => {})
  }
}

main().catch(error => {
  console.error(error?.message ?? String(error))
  process.exit(1)
})
