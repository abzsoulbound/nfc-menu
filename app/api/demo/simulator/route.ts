import { badRequest, ok, readJson } from "@/lib/http"
import {
  getDemoSimulatorStatus,
  runDemoSimulatorBurst,
  runDemoSimulatorTick,
  startDemoSimulator,
  stopDemoSimulator,
} from "@/lib/demoSimulator"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { resetRuntimeState } from "@/lib/runtimeStore"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

type DemoSimulatorAction =
  | "START"
  | "STOP"
  | "TICK"
  | "BURST"
  | "START_AND_BURST"
  | "RESET"

type DemoSimulatorBody = {
  action?: DemoSimulatorAction
  burstTicks?: number
}

function parseBurstTicks(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(24, Math.floor(parsed)))
}

function demoDisabled() {
  return new Response(null, {
    status: 404,
  })
}

async function persistAndBroadcast(status: ReturnType<typeof getDemoSimulatorStatus>) {
  await persistRuntimeStateToDb()
  publishRuntimeEvent("demo.simulator", {
    enabled: status.enabled,
    lastTickAt: status.lastTickAt,
    kitchenQueue: status.queue.kitchen,
    barQueue: status.queue.bar,
    readyQueue: status.queue.ready,
    activeDemoSessions: status.activeDemoSessions,
    simulatedMinuteOfDay: status.simulatedMinuteOfDay,
    simulatedTimeLabel: status.simulatedTimeLabel,
    autoMode: status.autoMode,
    stepMinutes: status.stepMinutes,
    isRushHour: status.isRushHour,
    dayComplete: status.dayComplete,
  })
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    if (!isDemoToolsEnabled()) {
      return demoDisabled()
    }

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
      changed = !before.enabled
    }

    if (burstTicks > 0) {
      const burst = runDemoSimulatorBurst({
        ticks: burstTicks,
        force: true,
      })
      changed = changed || burst.changed || burst.ran
      ran = ran || burst.ran
      ticks = burst.ticks
    } else {
      const tick = runDemoSimulatorTick()
      changed = changed || tick.changed || tick.ran
      ran = ran || tick.ran
      ticks = tick.ran ? 1 : 0
    }

    if (changed) {
      await persistAndBroadcast(getDemoSimulatorStatus())
    }

    return ok({
      status: getDemoSimulatorStatus(),
      ran,
      changed,
      ticks,
    })
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async () => {
    if (!isDemoToolsEnabled()) {
      return demoDisabled()
    }

    await hydrateRuntimeStateFromDb()
    const body = await readJson<DemoSimulatorBody>(req)
    const action = body.action ?? "START_AND_BURST"

    if (
      action !== "START" &&
      action !== "STOP" &&
      action !== "TICK" &&
      action !== "BURST" &&
      action !== "START_AND_BURST" &&
      action !== "RESET"
    ) {
      return badRequest(
        "action must be START, STOP, TICK, BURST, START_AND_BURST, or RESET"
      )
    }

    let changed = false
    let ran = false
    let ticks = 0

    if (action === "RESET") {
      resetRuntimeState()
      changed = true
      await persistAndBroadcast(getDemoSimulatorStatus())
      return ok({
        status: getDemoSimulatorStatus(),
        ran: false,
        changed,
        ticks: 0,
      })
    }

    if (action === "STOP") {
      const before = getDemoSimulatorStatus()
      const status = stopDemoSimulator()
      changed = before.enabled
      await persistAndBroadcast(status)
      return ok({
        status,
        ran: false,
        changed,
        ticks: 0,
      })
    }

    if (
      action === "START" ||
      action === "START_AND_BURST" ||
      action === "BURST" ||
      action === "TICK"
    ) {
      const before = getDemoSimulatorStatus()
      startDemoSimulator()
      changed = changed || !before.enabled
    }

    if (action === "TICK") {
      const tick = runDemoSimulatorTick({
        force: true,
      })
      changed = changed || tick.changed || tick.ran
      ran = tick.ran
      ticks = tick.ran ? 1 : 0
    } else if (action === "BURST" || action === "START_AND_BURST") {
      const burst = runDemoSimulatorBurst({
        ticks: parseBurstTicks(
          body.burstTicks,
          action === "BURST" ? 2 : 4
        ),
        force: true,
      })
      changed = changed || burst.changed || burst.ran
      ran = burst.ran
      ticks = burst.ticks
    }

    if (changed) {
      await persistAndBroadcast(getDemoSimulatorStatus())
    }

    return ok({
      status: getDemoSimulatorStatus(),
      ran,
      changed,
      ticks,
    })
  })
}
