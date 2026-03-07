import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const filesToCheck = [
  ".env.neoncheck.production",
  ".env.ci.production",
]

const secretPatterns = [
  {
    label: "Stripe live secret key",
    regex: /\b(?:sk_live_|rk_live_)[A-Za-z0-9]{16,}\b/g,
  },
  {
    label: "Stripe live publishable key",
    regex: /\bpk_live_[A-Za-z0-9]{16,}\b/g,
  },
  {
    label: "Stripe webhook secret",
    regex: /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  },
]

const findings = []

const trackedFiles = new Set(
  execSync("git ls-files", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
)

function isAllowedFixtureToken(token) {
  return token.includes("CIEXAMPLEONLY")
}

for (const relativePath of filesToCheck) {
  const filePath = path.join(ROOT, relativePath)
  if (!trackedFiles.has(relativePath)) continue
  if (!fs.existsSync(filePath)) continue
  const content = fs.readFileSync(filePath, "utf8")

  for (const pattern of secretPatterns) {
    const matches = content.match(pattern.regex) ?? []
    for (const match of matches) {
      if (isAllowedFixtureToken(match)) {
        continue
      }
      findings.push({
        file: relativePath,
        label: pattern.label,
        tokenPreview: `${match.slice(0, 8)}...${match.slice(-4)}`,
      })
    }
  }
}

if (findings.length > 0) {
  console.error("Detected live-looking Stripe secrets in tracked env files:")
  for (const finding of findings) {
    console.error(
      `- ${finding.file}: ${finding.label} (${finding.tokenPreview})`
    )
  }
  console.error(
    "Remove real keys from tracked files and keep them only in runtime secret managers."
  )
  process.exit(1)
}

console.log("No live-looking Stripe secrets found in tracked env files.")
