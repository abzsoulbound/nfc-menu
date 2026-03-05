import { badRequest, ok, readJson } from "@/lib/http"
import {
  getDemoSimulatorStatus,
  runDemoSimulatorBurst,
  runDemoSimulatorTick,
  startDemoSimulator,
  stopDemoSimulator,
} from "@/lib/demoSimulator"
import {
  getFeatureSummary,
  getShiftReport,
  listCheckoutReceipts,
  listSessions,
  listTables,
  resetRuntimeState,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { isSalesDemoSlug } from "@/lib/tenant"

export const dynamic = "force-dynamic"

type SalesSimulatorAction =
  | "START"
  | "STOP"
  | "TICK"
  | "BURST"
  | "START_AND_BURST"
  | "RESET"

type SalesSimulatorBody = {
  action?: SalesSimulatorAction
  burstTicks?: number
}

function parseBurstTicks(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(24, Math.floor(parsed)))
}

function buildSnapshot() {
  const status = getDemoSimulatorStatus()
  const shift = getShiftReport()
  const features = getFeatureSummary()
  const tables = listTables()
  const sessions = listSessions()
  const activeSessions = sessions.filter(
    session => session.stale !== true
  ).length

  return {
    status,
    shift,
    features,
    live: {
      activeSessions,
      demoSessions: status.activeDemoSessions,
      openTables: tables.filter(table => table.closed !== true).length,
      lockedTables: tables.filter(table => table.locked === true).length,
      checkoutReceipts: listCheckoutReceipts(200).length,
    },
  }
}

async function persistAndBroadcast() {
  const status = getDemoSimulatorStatus()
  await persistRuntimeStateToDb()
  publishRuntimeEvent("demo.simulator", {
    enabled: status.enabled,
    lastTickAt: status.lastTickAt,
    kitchenQueue: status.queue.kitchen,
    barQueue: status.queue.bar,
    readyQueue: status.queue.ready,
    activeDemoSessions: status.activeDemoSessions,
  })
}

function ensureDemoTenant(input: { isDemo: boolean; slug: string }) {
  if (!input.isDemo || !isSalesDemoSlug(input.slug)) {
    throw new Error(
      "Sales simulator is available only on the dedicated sales demo tenant."
    )
  }
}

function isAllowedAction(
  action: string
): action is SalesSimulatorAction {
  return (
    action === "START" ||
    action === "STOP" ||
    action === "TICK" ||
    action === "BURST" ||
    action === "START_AND_BURST" ||
    action === "RESET"
  )
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      ensureDemoTenant({
        isDemo: restaurant.isDemo,
        slug: restaurant.slug,
      })
      await hydrateRuntimeStateFromDb()

      const url = new URL(req.url)
      const autostart = url.searchParams.get("autostart") === "1"
      const burstTicks = parseBurstTicks(
        url.searchParams.get("burstTicks"),
        0
      )

      let changed = false
      let ran = false
      let ticks = 0

      if (autostart) {
        const before = getDemoSimulatorStatus()
        startDemoSimulator()
        changed = changed || !before.enabled
      }

      if (burstTicks > 0) {
        const burst = runDemoSimulatorBurst({
          ticks: burstTicks,
          force: true,
        })
        changed = changed || burst.changed
        ran = ran || burst.ran
        ticks = burst.ticks
      }

      if (changed) {
        await persistAndBroadcast()
      }

      return ok({
        snapshot: buildSnapshot(),
        ran,
        changed,
        ticks,
      })
    } catch (error) {
      const message = (error as Error).message
      const status =
        message ===
        "Sales simulator is available only on the dedicated sales demo tenant."
          ? 403
          : 400
      return badRequest(message, status)
    }
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      ensureDemoTenant({
        isDemo: restaurant.isDemo,
        slug: restaurant.slug,
      })
      await hydrateRuntimeStateFromDb()

      const body = await readJson<SalesSimulatorBody>(req)
      const rawAction = body.action ?? "START_AND_BURST"
      if (!isAllowedAction(rawAction)) {
        return badRequest(
          "action must be START, STOP, TICK, BURST, START_AND_BURST, or RESET"
        )
      }

      const action = rawAction
      let changed = false
      let ran = false
      let ticks = 0

      if (action === "RESET") {
        resetRuntimeState()
        changed = true
      } else if (action === "STOP") {
        const before = getDemoSimulatorStatus()
        stopDemoSimulator()
        changed = before.enabled
      } else {
        const before = getDemoSimulatorStatus()
        startDemoSimulator()
        changed = changed || !before.enabled

        if (action === "START") {
          ticks = 0
        } else if (action === "TICK") {
          const tick = runDemoSimulatorTick({ force: true })
          ran = tick.ran
          changed = changed || tick.changed
          ticks = tick.ran ? 1 : 0
        } else {
          const burst = runDemoSimulatorBurst({
            ticks: parseBurstTicks(
              body.burstTicks,
              action === "BURST" ? 2 : 4
            ),
            force: true,
          })
          ran = burst.ran
          changed = changed || burst.changed
          ticks = burst.ticks
        }
      }

      if (changed) {
        await persistAndBroadcast()
      }

      return ok({
        snapshot: buildSnapshot(),
        ran,
        changed,
        ticks,
      })
    } catch (error) {
      const message = (error as Error).message
      const status =
        message ===
        "Sales simulator is available only on the dedicated sales demo tenant."
          ? 403
          : 400
      return badRequest(message, status)
    }
  })
}
