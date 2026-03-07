import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { cleanNextDistDir } from "./clean-next-dist.mjs"

const ROOT = process.cwd()

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/qa-route-smoke.mjs [--env-file <path>]",
      "",
      "Options:",
      "  --env-file  Load launch env values before building and route checks.",
      "",
      "Environment flags:",
      "  QA_REQUIRE_READY=true  Fail if /api/ops/readiness is not 200.",
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
  if (!fs.existsSync(filePath)) return {}
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const map = {}
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = stripOuterQuotes(
      line.slice(eq + 1).trim()
    )
    map[key] = value
  }
  return map
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return process.argv[index + 1]?.trim() ?? ""
}

function resolveEnvFile() {
  const fromArgs = getArgValue("--env-file")
  const fromEnv = process.env.QA_ENV_FILE?.trim() ?? ""
  const selected = fromArgs || fromEnv
  if (!selected) return ""
  return path.resolve(ROOT, selected)
}

if (process.argv.includes("--help")) {
  usage()
  process.exit(0)
}

const envFile = resolveEnvFile()
if (envFile) {
  const envFromFile = parseEnvFile(envFile)
  Object.assign(process.env, envFromFile)
  console.log(`[qa:routes] ENV_FILE=${envFile}`)
}

function firstCode(raw) {
  const normalized = stripOuterQuotes(String(raw ?? "").trim())
  if (!normalized || normalized === "changeme") return null
  return normalized
    .split(",")
    .map(code => stripOuterQuotes(code.trim()))
    .find(code => /^\d{4}$/.test(code)) ?? null
}

const envLocal = parseEnvFile(path.join(ROOT, ".env.local"))

function resolveEnvValue(key) {
  const runtimeValue = process.env[key]
  if (
    typeof runtimeValue === "string" &&
    runtimeValue.trim() !== ""
  ) {
    return stripOuterQuotes(runtimeValue.trim())
  }

  const localValue = envLocal[key]
  if (
    typeof localValue === "string" &&
    localValue.trim() !== ""
  ) {
    return stripOuterQuotes(localValue.trim())
  }

  return ""
}

const PORT = Number(process.env.QA_ROUTE_PORT || 4317)
const BASE_URL = `http://127.0.0.1:${PORT}`
const NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || ".next-build"
const NEXT_BIN = path.join(
  ROOT,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
)

const DEFAULT_RESTAURANT_SLUG =
  resolveEnvValue("DEFAULT_RESTAURANT_SLUG") || "demo-template"

const protectedRoutes = [
  "/staff",
  "/staff/tables",
  "/staff/tags",
  "/staff/sessions",
  "/kitchen",
  "/bar",
  "/manager",
  "/manager/customize",
  "/admin",
]

const routeRoleMap = {
  "/staff": ["WAITER", "MANAGER", "ADMIN"],
  "/staff/tables": ["WAITER", "MANAGER", "ADMIN"],
  "/staff/tags": ["WAITER", "MANAGER", "ADMIN"],
  "/staff/sessions": ["WAITER", "MANAGER", "ADMIN"],
  "/kitchen": ["KITCHEN", "MANAGER", "ADMIN"],
  "/bar": ["BAR", "MANAGER", "ADMIN"],
  "/manager": ["MANAGER", "ADMIN"],
  "/manager/customize": ["MANAGER", "ADMIN"],
  "/admin": ["ADMIN"],
}

const publicRoutes = [
  "/",
  "/contact",
  "/pricing",
  "/refunds",
  "/terms",
  "/privacy",
  "/connect-demo",
  "/connect-demo/success",
  "/menu",
  "/guest-tools",
  "/order/takeaway",
  "/order/demo-tag",
  "/order/review/demo-tag",
  "/order/1/review",
  "/staff-login",
]

function startServer() {
  const runtimeIssues = []
  const runtimeIssueSet = new Set()

  function captureRuntimeIssue(rawChunk) {
    const chunk = String(rawChunk ?? "")
    if (!chunk) return
    const lowered = chunk.toLowerCase()
    const hasPrismaError =
      lowered.includes("prisma:error") ||
      chunk.includes("Invalid `prisma.")
    if (!hasPrismaError) return

    const message = chunk
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ")
      .slice(0, 320)

    if (!message || runtimeIssueSet.has(message)) return
    runtimeIssueSet.add(message)
    runtimeIssues.push(message)
  }

  const child = spawn(process.execPath, [NEXT_BIN, "start", "-p", `${PORT}`], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: `${PORT}`,
      NEXT_DIST_DIR,
    },
  })

  child.stdout.on("data", chunk => {
    captureRuntimeIssue(chunk)
    process.stdout.write(`[next] ${chunk}`)
  })
  child.stderr.on("data", chunk => {
    captureRuntimeIssue(chunk)
    process.stderr.write(`[next] ${chunk}`)
  })

  return {
    child,
    getRuntimeIssues() {
      return [...runtimeIssues]
    },
  }
}

function hasProductionBuild() {
  const requiredFiles = [
    "BUILD_ID",
    "prerender-manifest.json",
    "routes-manifest.json",
  ]

  return requiredFiles.every(file =>
    fs.existsSync(path.join(ROOT, NEXT_DIST_DIR, file))
  )
}

function runBuild() {
  return new Promise((resolve, reject) => {
    cleanNextDistDir(NEXT_DIST_DIR)
      .then(() => {
        const child = spawn(process.execPath, [NEXT_BIN, "build"], {
          cwd: ROOT,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NEXT_DIST_DIR,
          },
        })

        child.stdout.on("data", chunk => {
          process.stdout.write(`[build] ${chunk}`)
        })
        child.stderr.on("data", chunk => {
          process.stderr.write(`[build] ${chunk}`)
        })

        child.on("exit", code => {
          if (code === 0) {
            resolve()
            return
          }
          reject(
            new Error(`next build failed with exit code ${code ?? -1}`)
          )
        })
        child.on("error", reject)
      })
      .catch(reject)
  })
}

function parseCookiePairsFromSetCookie(setCookieValues) {
  return setCookieValues
    .map(raw => String(raw).split(";")[0]?.trim() ?? "")
    .filter(Boolean)
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie()
  }
  const raw = response.headers.get("set-cookie")
  if (!raw) return []
  return raw.split(/,(?=[^;]+?=)/g)
}

async function loginAsStaff(passcode) {
  const routeRes = await fetch(
    `${BASE_URL}/r/${encodeURIComponent(DEFAULT_RESTAURANT_SLUG)}?next=/staff-login`,
    { redirect: "manual" }
  )
  const routeCookies = parseCookiePairsFromSetCookie(
    getSetCookies(routeRes)
  )

  const loginRes = await fetch(`${BASE_URL}/api/auth/staff`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: routeCookies.join("; "),
    },
    body: JSON.stringify({ passcode }),
  })

  if (!loginRes.ok) {
    throw new Error(`Staff login failed with status ${loginRes.status}`)
  }

  const body = await loginRes.json()
  const loginCookies = parseCookiePairsFromSetCookie(
    getSetCookies(loginRes)
  )

  const allCookies = [...routeCookies, ...loginCookies]
  const deduped = new Map()
  for (const cookie of allCookies) {
    const [name] = cookie.split("=")
    if (!name) continue
    deduped.set(name.trim(), cookie)
  }

  return {
    role: body.role,
    cookieHeader: Array.from(deduped.values()).join("; "),
  }
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
  if (!hasProductionBuild()) {
    console.log(
      `[info] No production build found in ${NEXT_DIST_DIR}. Building first.`
    )
    await runBuild()
  }

  const server = startServer()
  let exitCode = 0

  try {
    await waitUntilReady()

    const failures = []
    const strictReadiness =
      String(process.env.QA_REQUIRE_READY ?? "")
        .trim()
        .toLowerCase() === "true"

    const readinessRes = await fetch(`${BASE_URL}/api/ops/readiness`, {
      redirect: "manual",
    })
    const readinessText = await readinessRes.text()
    let readinessJson = null
    try {
      readinessJson = readinessText ? JSON.parse(readinessText) : null
    } catch {
      readinessJson = null
    }
    const readinessOk = readinessRes.status === 200
    if (!readinessOk) {
      const detail = readinessJson?.checks ?? readinessText
      const reason = strictReadiness
        ? "Readiness endpoint must be 200 in strict mode"
        : "Readiness endpoint is degraded (warning mode)"
      const record = {
        route: "/api/ops/readiness",
        status: readinessRes.status,
        location: null,
        reason: `${reason}: ${JSON.stringify(detail).slice(0, 360)}`,
      }
      if (strictReadiness) {
        failures.push(record)
      } else {
        console.warn(`[warn] ${record.reason}`)
      }
    }
    console.log(
      `[readiness] /api/ops/readiness -> ${readinessRes.status}${
        strictReadiness ? " (strict)" : " (warning)"
      }`
    )

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
      firstCode(resolveEnvValue("ADMIN_PASSCODES")) ??
      firstCode(resolveEnvValue("MANAGER_PASSCODES")) ??
      firstCode(resolveEnvValue("WAITER_PASSCODES"))

    if (authCode) {
      const auth = await loginAsStaff(authCode)
      for (const route of protectedRoutes) {
        const result = await checkRoute(route, {
          headers: { cookie: auth.cookieHeader },
        })
        const allowedRoles = routeRoleMap[route] ?? []
        const shouldAllow = allowedRoles.includes(auth.role)
        const routeAllowed = result.status >= 200 && result.status < 300
        const routeRedirectAllowed =
          result.status >= 300 &&
          result.status < 400 &&
          typeof result.location === "string" &&
          !result.location.includes("/staff-login")
        const routeDeniedByRole =
          result.status >= 300 &&
          result.status < 400 &&
          typeof result.location === "string" &&
          result.location.includes("/staff-login")

        const ok = shouldAllow
          ? routeAllowed || routeRedirectAllowed
          : routeDeniedByRole

        if (!ok) {
          failures.push({
            ...result,
            reason: shouldAllow
              ? `Protected route should be accessible for role ${auth.role}`
              : `Protected route should be denied for role ${auth.role}`,
          })
        }
        console.log(
          `[protected-auth:${auth.role}] ${route} -> ${result.status}${result.location ? ` (${result.location})` : ""}`
        )
      }
    } else {
      console.log(
        "[info] No staff passcodes detected for authenticated route smoke checks."
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
      const runtimeIssues = server.getRuntimeIssues()
      if (runtimeIssues.length > 0) {
        exitCode = 1
        console.error(
          "\nRoute smoke detected runtime Prisma/database issues:"
        )
        for (const issue of runtimeIssues) {
          console.error(`- ${issue}`)
        }
      }
    }

    if (exitCode === 0) {
      console.log("\nRoute smoke checks passed.")
    } else {
      console.error(
        "\nRoute smoke checks failed. Resolve runtime issues before release."
      )
    }
  } finally {
    server.child.kill()
    await delay(300)
  }

  process.exit(exitCode)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
