import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { rm } from "node:fs/promises"

const ROOT = process.cwd()
const NEXT_DIST_DIR = ".next-build-release"

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
  const fromArgs = getArgValue("--env-file")
  const fromEnv = process.env.QA_ENV_FILE?.trim() ?? ""
  const selected = fromArgs || fromEnv
  if (!selected) return null
  return path.resolve(ROOT, selected)
}

function isEnabled(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

function runNpm(script, commandEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(`npm run ${script}`, {
      stdio: "inherit",
      cwd: ROOT,
      env: commandEnv,
      shell: true,
    })

    child.on("exit", code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `npm run ${script} failed with exit code ${code ?? -1}`
        )
      )
    })
    child.on("error", reject)
  })
}

async function main() {
  const envFile = resolveEnvFile()
  const envOverrides = envFile ? parseEnvFile(envFile) : {}
  const strictMigrations =
    process.argv.includes("--strict-migrations") ||
    isEnabled(process.env.QA_STRICT_MIGRATIONS)

  const baseEnv = {
    ...process.env,
    NEXT_DIST_DIR,
  }
  const prodEnv = {
    ...baseEnv,
    ...envOverrides,
  }
  if (envFile) {
    prodEnv.QA_ENV_FILE = envFile
  }

  const releaseSteps = [
    { script: "prisma:generate", env: baseEnv, required: true },
    {
      script: "prisma:migrate:status",
      env: envFile ? prodEnv : baseEnv,
      required: strictMigrations,
    },
    { script: "qa:prod:env", env: envFile ? prodEnv : baseEnv, required: true },
    { script: "typecheck", env: baseEnv, required: true },
    { script: "lint", env: baseEnv, required: true },
    { script: "test", env: baseEnv, required: true },
    { script: "build", env: envFile ? prodEnv : baseEnv, required: true },
    { script: "qa:routes", env: envFile ? prodEnv : baseEnv, required: true },
  ]

  console.log(`[qa:release] NEXT_DIST_DIR=${NEXT_DIST_DIR}`)
  if (envFile) {
    console.log(`[qa:release] ENV_FILE=${envFile}`)
  }
  console.log(
    `[qa:release] STRICT_MIGRATIONS=${strictMigrations ? "true" : "false"}`
  )

  await rm(NEXT_DIST_DIR, {
    recursive: true,
    force: true,
    maxRetries: 3,
  }).catch(() => {
    // best-effort cleanup
  })

  const warnings = []
  for (const step of releaseSteps) {
    try {
      await runNpm(step.script, step.env)
    } catch (error) {
      if (step.required !== false) {
        throw error
      }
      const message = (error && error.message) || String(error)
      warnings.push({ script: step.script, message })
      console.warn(
        `[qa:release] WARN: ${step.script} failed but strict migration checks are disabled.`
      )
      console.warn(`[qa:release] WARN: ${message}`)
      console.warn(
        "[qa:release] WARN: Continuing. Use --strict-migrations to enforce migration history."
      )
    }
  }

  if (warnings.length > 0) {
    console.warn("[qa:release] Completed with warnings:")
    for (const warning of warnings) {
      console.warn(`- ${warning.script}: ${warning.message}`)
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
