import { rm } from "node:fs/promises"
import { pathToFileURL } from "node:url"

const DEFAULT_NEXT_DIST_DIR = ".next"

export async function cleanNextDistDir(
  distDir = process.env.NEXT_DIST_DIR?.trim() || DEFAULT_NEXT_DIST_DIR
) {
  if (!distDir) return

  await rm(distDir, {
    recursive: true,
    force: true,
    maxRetries: 3,
  }).catch(error => {
    if (error?.code !== "ENOENT") {
      throw error
    }
  })
}

async function main() {
  await cleanNextDistDir()
}

const entryUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null

if (entryUrl === import.meta.url) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
