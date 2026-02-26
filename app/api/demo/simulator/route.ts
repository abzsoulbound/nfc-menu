import { badRequest, ok, readJson } from "@/lib/http"
import {
  getDemoSimulatorStatus,
  runDemoSimulatorTick,
  startDemoSimulator,
  stopDemoSimulator,
} from "@/lib/demoSimulator"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"

export const dynamic = "force-dynamic"

type DemoSimulatorAction = "START" | "STOP" | "TICK" | "START_AND_TICK"

type DemoSimulatorBody = {
  action?: DemoSimulatorAction
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
  })
}

export async function GET(req: Request) {
  await hydrateRuntimeStateFromDb()
  const url = new URL(req.url)
  const autostart = url.searchParams.get("autostart") === "1"

  let changed = false
  if (autostart) {
    const before = getDemoSimulatorStatus()
    startDemoSimulator()
    changed = !before.enabled
  }

  const tick = runDemoSimulatorTick()
  changed = changed || tick.changed

  if (changed) {
    await persistAndBroadcast(tick.status)
  }

  return ok({
    status: tick.status,
    ran: tick.ran,
    changed,
  })
}

export async function POST(req: Request) {
  await hydrateRuntimeStateFromDb()
  const body = await readJson<DemoSimulatorBody>(req)
  const action = body.action ?? "START_AND_TICK"

  if (
    action !== "START" &&
    action !== "STOP" &&
    action !== "TICK" &&
    action !== "START_AND_TICK"
  ) {
    return badRequest("action must be START, STOP, TICK, or START_AND_TICK")
  }

  let changed = false

  if (action === "STOP") {
    const status = stopDemoSimulator()
    changed = true
    await persistAndBroadcast(status)
    return ok({
      status,
      ran: false,
      changed,
    })
  }

  if (action === "START" || action === "START_AND_TICK") {
    const before = getDemoSimulatorStatus()
    startDemoSimulator()
    changed = changed || !before.enabled
  }

  const tick = runDemoSimulatorTick({
    force: action === "TICK" || action === "START_AND_TICK",
  })
  changed = changed || tick.changed

  if (changed) {
    await persistAndBroadcast(tick.status)
  }

  return ok({
    status: tick.status,
    ran: tick.ran,
    changed,
  })
}
