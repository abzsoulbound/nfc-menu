import path from "node:path"
import { spawn } from "node:child_process"
import { rm } from "node:fs/promises"

const ROOT = process.cwd()
const PORT = process.env.PORT || "4400"
const NEXT_DIST_DIR = ".next-e2e"
const NEXT_BIN = path.join(
  ROOT,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
)

function runNext(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [NEXT_BIN, command, ...args],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          PORT,
          NEXT_DIST_DIR,
        },
      }
    )

    child.on("exit", code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(`next ${command} failed with exit code ${code ?? -1}`)
      )
    })
    child.on("error", reject)
  })
}

async function main() {
  await rm(NEXT_DIST_DIR, {
    recursive: true,
    force: true,
    maxRetries: 3,
  }).catch(() => {
    // best-effort cleanup
  })

  await runNext("build")

  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-p", PORT],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        PORT,
        NEXT_DIST_DIR,
      },
    }
  )

  child.on("exit", code => {
    process.exit(code ?? 0)
  })
  child.on("error", error => {
    console.error(error)
    process.exit(1)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
