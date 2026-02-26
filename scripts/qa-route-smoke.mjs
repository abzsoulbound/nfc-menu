import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const PORT = Number(process.env.QA_ROUTE_PORT || 4317)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ROOT = process.cwd()
const NEXT_BIN = path.join(
  ROOT,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
)

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const map = {}
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    map[key] = value
  }
  return map
}

function firstCode(raw) {
  if (!raw || raw === "changeme") return null
  return raw
    .split(",")
    .map(code => code.trim())
    .find(code => /^\d{4}$/.test(code)) ?? null
}

const envLocal = parseEnvFile(path.join(ROOT, ".env.local"))

const protectedRoutes = [
  "/waiter",
  "/waiter/tables",
  "/waiter/tags",
  "/waiter/sessions",
  "/kitchen",
  "/bar",
  "/manager",
  "/admin",
]

const publicRoutes = [
  "/",
  "/menu",
  "/order/takeaway",
  "/order/demo-tag",
  "/order/review/demo-tag",
  "/order/1/review",
  "/staff-login",
  "/t/demo-tag",
  "/t/demo-tag/review",
  "/table/1/review",
  "/t/demo-tag/closed",
]

function startServer() {
  const child = spawn(process.execPath, [NEXT_BIN, "start", "-p", `${PORT}`], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: `${PORT}`,
    },
  })

  child.stdout.on("data", chunk => {
    process.stdout.write(`[next] ${chunk}`)
  })
  child.stderr.on("data", chunk => {
    process.stderr.write(`[next] ${chunk}`)
  })

  return child
}

async function waitUntilReady(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/menu`, {
        redirect: "manual",
      })
      if (res.status >= 200 && res.status < 500) return
    } catch {
      // wait and retry
    }
    await delay(500)
  }
  throw new Error("Next server did not become ready in time")
}

async function checkRoute(route, options = {}) {
  const res = await fetch(`${BASE_URL}${route}`, {
    redirect: "manual",
    headers: options.headers ?? {},
  })
  const location = res.headers.get("location")
  return {
    route,
    status: res.status,
    location,
  }
}

async function main() {
  const server = startServer()
  let exitCode = 0

  try {
    await waitUntilReady()

    const failures = []

    for (const route of publicRoutes) {
      const result = await checkRoute(route)
      const ok = result.status >= 200 && result.status < 400
      if (!ok) {
        failures.push({
          ...result,
          reason: "Public route not accessible",
        })
      }
      console.log(
        `[public] ${route} -> ${result.status}${result.location ? ` (${result.location})` : ""}`
      )
    }

    for (const route of protectedRoutes) {
      const result = await checkRoute(route)
      const redirectsToLogin =
        result.status >= 300 &&
        result.status < 400 &&
        typeof result.location === "string" &&
        result.location.includes("/staff-login")

      const openWithoutAuth = result.status >= 200 && result.status < 300
      if (!redirectsToLogin && !openWithoutAuth) {
        failures.push({
          ...result,
          reason: "Protected route did not render or redirect correctly",
        })
      }
      console.log(
        `[protected-guest] ${route} -> ${result.status}${result.location ? ` (${result.location})` : ""}`
      )
    }

    const authCode =
      firstCode(envLocal.ADMIN_PASSCODES) ??
      firstCode(envLocal.MANAGER_PASSCODES) ??
      firstCode(envLocal.WAITER_PASSCODES)

    if (authCode) {
      const cookie = `staff_auth=${encodeURIComponent(authCode)}`
      for (const route of protectedRoutes) {
        const result = await checkRoute(route, {
          headers: { cookie },
        })
        const ok = result.status >= 200 && result.status < 300
        if (!ok) {
          failures.push({
            ...result,
            reason: "Protected route not accessible with auth cookie",
          })
        }
        console.log(
          `[protected-auth] ${route} -> ${result.status}${result.location ? ` (${result.location})` : ""}`
        )
      }
    } else {
      console.log(
        "[info] No staff passcodes detected in .env.local for authenticated route smoke checks."
      )
    }

    if (failures.length > 0) {
      exitCode = 1
      console.error("\nRoute smoke failures:")
      for (const failure of failures) {
        console.error(
          `- ${failure.route}: ${failure.status} ${failure.location ?? ""} | ${failure.reason}`
        )
      }
    } else {
      console.log("\nRoute smoke checks passed.")
    }
  } finally {
    server.kill()
    await delay(300)
  }

  process.exit(exitCode)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

