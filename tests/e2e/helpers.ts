import fs from "node:fs"
import path from "node:path"

type StaffRole =
  | "WAITER"
  | "BAR"
  | "KITCHEN"
  | "MANAGER"
  | "ADMIN"

const ROLE_ENV_KEYS: Record<StaffRole, string> = {
  WAITER: "WAITER_PASSCODES",
  BAR: "BAR_PASSCODES",
  KITCHEN: "KITCHEN_PASSCODES",
  MANAGER: "MANAGER_PASSCODES",
  ADMIN: "ADMIN_PASSCODES",
}

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {}

  const content = fs.readFileSync(filePath, "utf8")
  const lines = content.split(/\r?\n/)
  const env: Record<string, string> = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const eq = line.indexOf("=")
    if (eq < 0) continue

    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "")
    env[key] = value
  }

  return env
}

function firstCode(raw: string | undefined) {
  if (!raw || raw === "changeme") return null
  return (
    raw
      .split(",")
      .map(code => code.trim())
      .find(code => /^\d{4}$/.test(code)) ?? null
  )
}

function readEnvMap() {
  const root = process.cwd()
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...process.env,
  }
}

export function resolveRolePasscode(role: StaffRole) {
  const envMap = readEnvMap()
  const fromRoleKey = firstCode(envMap[ROLE_ENV_KEYS[role]])
  if (fromRoleKey) return fromRoleKey

  if (role === "WAITER") {
    return firstCode(envMap.STAFF_AUTH_SECRET)
  }

  return null
}

export function isStaffAuthConfigured() {
  return (
    resolveRolePasscode("WAITER") !== null ||
    resolveRolePasscode("BAR") !== null ||
    resolveRolePasscode("KITCHEN") !== null ||
    resolveRolePasscode("MANAGER") !== null ||
    resolveRolePasscode("ADMIN") !== null
  )
}
