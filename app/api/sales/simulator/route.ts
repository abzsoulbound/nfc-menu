import { badRequest, ok, readJson } from "@/lib/http"
import {
  getDemoSimulatorStatus,
  resetDemoSimulatorDay,
  runDemoSimulatorBurst,
  runDemoSimulatorTick,
  setDemoSimulatorAutoRun,
  setDemoSimulatorStep,
  setDemoSimulatorTime,
  startDemoSimulator,
  stopDemoSimulator,
} from "@/lib/demoSimulator"
import {
  DEMO_SIM_DAY_END_MINUTE,
  DEMO_SIM_DAY_START_MINUTE,
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

export const dynamic = "force-dynamic"

const SALES_SIMULATOR_DEMO_ONLY_ERROR =
  "Sales simulator is available only on demo tenants."

type SalesSimulatorAction =
  | "START"
  | "STOP"
  | "TICK"
  | "STEP"
  | "BURST"
  | "START_AND_BURST"
  | "RESET"
  | "RESET_DAY"
  | "SET_AUTO_MODE"
  | "SET_STEP_MINUTES"
  | "SET_SIMULATED_TIME"

type SalesSimulatorBody = {
  action?: SalesSimulatorAction
  burstTicks?: number
  stepMinutes?: number
  autoMode?: boolean
  simulatedMinuteOfDay?: number
}

function parseBurstTicks(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(24, Math.floor(parsed)))
}

function parseStepMinutes(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(60, Math.floor(parsed)))
}

function parseSimulatedMinute(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(
    DEMO_SIM_DAY_START_MINUTE,
    Math.min(DEMO_SIM_DAY_END_MINUTE, Math.floor(parsed))
  )
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
    simulatedMinuteOfDay: status.simulatedMinuteOfDay,
    simulatedTimeLabel: status.simulatedTimeLabel,
    autoMode: status.autoMode,
    stepMinutes: status.stepMinutes,
    isRushHour: status.isRushHour,
    dayComplete: status.dayComplete,
  })
}

function ensureDemoTenant(input: { isDemo: boolean; slug: string }) {
  if (!input.isDemo) {
    throw new Error(SALES_SIMULATOR_DEMO_ONLY_ERROR)
  }
}

function isAllowedAction(
  action: string
): action is SalesSimulatorAction {
  return (
    action === "START" ||
    action === "STOP" ||
    action === "TICK" ||
    action === "STEP" ||
    action === "BURST" ||
    action === "START_AND_BURST" ||
    action === "RESET" ||
    action === "RESET_DAY" ||
    action === "SET_AUTO_MODE" ||
    action === "SET_STEP_MINUTES" ||
    action === "SET_SIMULATED_TIME"
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
      const stepMinutes = parseStepMinutes(
        url.searchParams.get("stepMinutes"),
        getDemoSimulatorStatus().stepMinutes
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
          stepMinutes,
        })
        changed = changed || burst.changed || burst.ran
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
        message === SALES_SIMULATOR_DEMO_ONLY_ERROR
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
          "action must be START, STOP, TICK, STEP, BURST, START_AND_BURST, RESET, RESET_DAY, SET_AUTO_MODE, SET_STEP_MINUTES, or SET_SIMULATED_TIME"
        )
      }

      const action = rawAction
      let changed = false
      let ran = false
      let ticks = 0

      if (action === "RESET") {
        resetRuntimeState()
        changed = true
      } else if (action === "RESET_DAY") {
        const before = getDemoSimulatorStatus()
        resetDemoSimulatorDay()
        const after = getDemoSimulatorStatus()
        changed =
          before.simulatedMinuteOfDay !== after.simulatedMinuteOfDay ||
          before.lastTickAt !== after.lastTickAt ||
          before.autoMode !== after.autoMode
      } else if (action === "STOP") {
        const before = getDemoSimulatorStatus()
        stopDemoSimulator()
        const after = getDemoSimulatorStatus()
        changed =
          before.enabled !== after.enabled ||
          before.autoMode !== after.autoMode
      } else if (action === "SET_AUTO_MODE") {
        const before = getDemoSimulatorStatus()
        const autoMode = body.autoMode === true
        if (autoMode && !before.enabled) {
          startDemoSimulator()
        }
        setDemoSimulatorAutoRun(autoMode)
        const after = getDemoSimulatorStatus()
        changed =
          before.enabled !== after.enabled ||
          before.autoMode !== after.autoMode
      } else if (action === "SET_STEP_MINUTES") {
        const before = getDemoSimulatorStatus()
        const stepMinutes = parseStepMinutes(
          body.stepMinutes,
          before.stepMinutes
        )
        setDemoSimulatorStep(stepMinutes)
        changed = before.stepMinutes !== stepMinutes
      } else if (action === "SET_SIMULATED_TIME") {
        const before = getDemoSimulatorStatus()
        const minute = parseSimulatedMinute(
          body.simulatedMinuteOfDay,
          before.simulatedMinuteOfDay
        )
        setDemoSimulatorTime(minute)
        const after = getDemoSimulatorStatus()
        changed =
          before.simulatedMinuteOfDay !== after.simulatedMinuteOfDay
      } else {
        const before = getDemoSimulatorStatus()
        startDemoSimulator()
        changed = changed || !before.enabled

        const stepMinutes = parseStepMinutes(
          body.stepMinutes,
          getDemoSimulatorStatus().stepMinutes
        )

        if (action === "START") {
          ticks = 0
        } else if (action === "TICK" || action === "STEP") {
          const tick = runDemoSimulatorTick({
            force: true,
            stepMinutes,
          })
          ran = tick.ran
          changed = changed || tick.changed || tick.ran
          ticks = tick.ran ? 1 : 0
        } else {
          const burst = runDemoSimulatorBurst({
            ticks: parseBurstTicks(
              body.burstTicks,
              action === "BURST" ? 2 : 4
            ),
            force: true,
            stepMinutes,
          })
          ran = burst.ran
          changed = changed || burst.changed || burst.ran
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
        message === SALES_SIMULATOR_DEMO_ONLY_ERROR
          ? 403
          : 400
      return badRequest(message, status)
    }
  })
}
