import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const DEFAULT_BASE_URL = "http://localhost:3000"
const DEFAULT_DELAY_MS = 220

const PROFILE_STEPS = {
  "first-run": [
    {
      path: "/sales-demo",
      feed: "Open Sales Demo and set simulator to First Run Through.",
    },
    {
      path: "/menu",
      feed: "Show instant customer entry into branded menu experience.",
    },
    {
      path: "/order/takeaway",
      feed: "Create a realistic basket with edits and quantity changes.",
    },
    {
      path: "/order/review/demo-tag",
      feed: "Highlight review safety before final submission.",
    },
    {
      path: "/guest-tools",
      feed: "Show support path so automation never blocks human help.",
    },
    {
      path: "/pay/1",
      feed: "Close with checkout completion and trust-focused totals.",
    },
  ],
  "rush-hour": [
    {
      path: "/sales-demo",
      feed: "Open Sales Demo and jump timeline to 11:00 or 14:00 Rush.",
    },
    {
      path: "/staff-login?next=/staff",
      feed: "Show floor ops visibility under higher traffic.",
    },
    {
      path: "/staff-login?next=/kitchen",
      feed: "Demonstrate kitchen queue throughput.",
    },
    {
      path: "/staff-login?next=/bar",
      feed: "Demonstrate parallel bar queue throughput.",
    },
    {
      path: "/staff-login?next=/manager",
      feed: "Show manager-level operational control during load.",
    },
    {
      path: "/staff-login?next=/manager/features",
      feed: "Tie operations to growth levers and commercial outcomes.",
    },
  ],
  full: [
    {
      path: "/sales-demo",
      feed: "Start in Sales Demo and run Full Day Autopilot (09:00-17:00).",
    },
    {
      path: "/menu",
      feed: "Customer discovery flow and confidence cues.",
    },
    {
      path: "/order/takeaway",
      feed: "Basket construction and guided ordering behavior.",
    },
    {
      path: "/order/review/demo-tag",
      feed: "Review gate for error prevention and reassurance.",
    },
    {
      path: "/guest-tools",
      feed: "Customer support options during self-service journey.",
    },
    {
      path: "/pay/1",
      feed: "Payment close with transparent totals.",
    },
    {
      path: "/staff-login?next=/staff",
      feed: "Waiter operations and table control.",
    },
    {
      path: "/staff-login?next=/kitchen",
      feed: "Kitchen queue handling.",
    },
    {
      path: "/staff-login?next=/bar",
      feed: "Bar queue handling.",
    },
    {
      path: "/staff-login?next=/manager",
      feed: "Manager operational dashboard.",
    },
    {
      path: "/staff-login?next=/manager/customize",
      feed: "Customization controls and journey variants.",
    },
    {
      path: "/staff-login?next=/manager/features",
      feed: "Engagement and experiment controls.",
    },
    {
      path: "/staff-login?next=/admin",
      feed: "Admin governance and readiness controls.",
    },
  ],
}

function usage() {
  console.log(
    [
      "Usage:",
      "  npm run demo:open -- --base-url <url> --tenant-slug <slug> [--profile first-run|rush-hour|full]",
      "",
      "Examples:",
      "  npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile first-run",
      "  npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile rush-hour",
      "  npm run demo:open -- --base-url https://fable-stores-nfc-menu.vercel.app --tenant-slug demo --profile full",
      "",
      "Optional:",
      "  --delay-ms <number>   Delay between opening tabs (default: 220)",
      "  --auto-feed           Add feed bootstrap query on first demo tab",
      "  --auto-next           With --auto-feed, jump to first guided step",
      "  --dry-run             Print URLs only, do not open browser tabs",
    ].join("\n")
  )
}

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return process.argv[index + 1]?.trim() ?? ""
}

function getTenantSlug() {
  const fromArg = getArg("--tenant-slug")
  if (fromArg) return fromArg
  const fromEnv = process.env.DEFAULT_RESTAURANT_SLUG?.trim()
  if (fromEnv) return fromEnv
  return "demo"
}

function sanitizeBaseUrl(raw) {
  const candidate = (raw || DEFAULT_BASE_URL).trim().replace(/\/+$/, "")
  try {
    const parsed = new URL(candidate)
    return parsed.toString().replace(/\/$/, "")
  } catch {
    throw new Error(`Invalid --base-url: ${candidate}`)
  }
}

function seedPath(tenantSlug, nextPath) {
  return `/r/${encodeURIComponent(tenantSlug)}?next=${encodeURIComponent(nextPath)}`
}

function feedProfileForLaunchProfile(profile) {
  if (profile === "first-run") return "first-run"
  if (profile === "rush-hour") return "rush-hour"
  return "full-story"
}

function openInDefaultBrowser(url) {
  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    return
  }

  if (process.platform === "darwin") {
    const child = spawn("open", [url], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    return
  }

  const child = spawn("xdg-open", [url], {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
}

async function main() {
  if (process.argv.includes("--help")) {
    usage()
    return
  }

  const tenantSlug = getTenantSlug()
  const profileRaw = (getArg("--profile") || "full").toLowerCase()
  const profile =
    profileRaw === "first-run" ||
    profileRaw === "rush-hour" ||
    profileRaw === "full"
      ? profileRaw
      : null

  if (!profile) {
    throw new Error(
      `Unsupported --profile: ${profileRaw}. Use first-run, rush-hour, or full.`
    )
  }

  const delayRaw = Number(getArg("--delay-ms") || DEFAULT_DELAY_MS)
  const delayMs = Number.isFinite(delayRaw)
    ? Math.max(0, Math.min(5000, Math.floor(delayRaw)))
    : DEFAULT_DELAY_MS
  const dryRun = process.argv.includes("--dry-run")
  const autoFeed = process.argv.includes("--auto-feed")
  const autoNext = process.argv.includes("--auto-next")
  const baseUrl = sanitizeBaseUrl(getArg("--base-url") || process.env.DEMO_BASE_URL)

  const feedProfile = feedProfileForLaunchProfile(profile)
  const steps = PROFILE_STEPS[profile].map((step, index) => {
    let nextPath = step.path
    if (
      index === 0 &&
      autoFeed &&
      (step.path.startsWith("/demo") ||
        step.path.startsWith("/sales-demo"))
    ) {
      const params = new URLSearchParams()
      params.set("feed", feedProfile)
      if (autoNext) {
        params.set("autoNext", "1")
      }
      const feedPathBase = step.path.startsWith("/sales-demo")
        ? "/sales-demo"
        : "/demo"
      nextPath = `${feedPathBase}?${params.toString()}`
    }

    return {
      ...step,
      path: nextPath,
      url: new URL(seedPath(tenantSlug, nextPath), baseUrl).toString(),
    }
  })

  console.log(`[demo:open] baseUrl=${baseUrl}`)
  console.log(`[demo:open] tenantSlug=${tenantSlug}`)
  console.log(`[demo:open] profile=${profile}`)
  console.log(`[demo:open] autoFeed=${autoFeed}`)
  console.log(`[demo:open] autoNext=${autoNext}`)
  console.log(`[demo:open] tabs=${steps.length}`)

  for (const [index, step] of steps.entries()) {
    console.log(`[${index + 1}/${steps.length}] ${step.url}`)
    console.log(`  feed: ${step.feed}`)
    if (!dryRun) {
      openInDefaultBrowser(step.url)
      if (delayMs > 0) {
        await delay(delayMs)
      }
    }
  }
}

main().catch(error => {
  console.error(`demo:open failed: ${(error && error.message) || String(error)}`)
  process.exit(1)
})
