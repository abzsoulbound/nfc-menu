import { OrderSubmissionItemDTO, Station } from "@/lib/types"
import { getRestaurantContextSlug } from "@/lib/tenantContext"
import {
  DEMO_SIM_DAY_END_MINUTE,
  DEMO_SIM_DAY_START_MINUTE,
  assignTag,
  createOrResumeSession,
  getDemoSimulatorConfig,
  getMenuItemMap,
  getReadyQueue,
  getStationQueue,
  listSessions,
  listTables,
  markStationPreparing,
  markStationSent,
  markTableDelivered,
  resetDemoSimulatorDayClock,
  setDemoSimulatorAutoMode,
  setDemoSimulatorClockMinute,
  setDemoSimulatorEnabled,
  setDemoSimulatorLastTick,
  setDemoSimulatorStepMinutes,
  submitOrder,
} from "@/lib/runtimeStore"

const DEMO_TAG_PREFIX = "demo-table-"
const DEMO_TABLE_MAX = 12
const MIN_TICK_INTERVAL_MS = 4500
const MAX_PENDING_LINES = 26
const MAX_STEP_MINUTES = 60

export const DEMO_SIM_RUSH_WINDOWS = [
  {
    startMinute: 11 * 60,
    endMinute: 12 * 60,
    label: "11:00-12:00",
  },
  {
    startMinute: 14 * 60,
    endMinute: 15 * 60,
    label: "14:00-15:00",
  },
] as const

const globalForDemoSimulator = globalThis as unknown as {
  __NFC_DEMO_SIM_LAST_RUN_MS_BY_TENANT__?: Record<string, number>
  __NFC_DEMO_SIM_SESSIONS_BY_TABLE_BY_TENANT__?: Record<
    string,
    Record<number, string>
  >
}

type TickResult = {
  ran: boolean
  changed: boolean
  status: DemoSimulatorStatus
}

type BurstResult = TickResult & {
  ticks: number
}

export type DemoSimulatorStatus = {
  enabled: boolean
  lastTickAt: string | null
  queue: {
    kitchen: number
    bar: number
    ready: number
  }
  activeDemoSessions: number
  simulatedMinuteOfDay: number
  simulatedTimeLabel: string
  dayStartMinute: number
  dayEndMinute: number
  stepMinutes: number
  autoMode: boolean
  isRushHour: boolean
  dayComplete: boolean
  rushWindows: ReadonlyArray<{
    startMinute: number
    endMinute: number
    label: string
  }>
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function clampStepMinutes(value: number) {
  if (!Number.isFinite(value)) return 10
  return Math.max(1, Math.min(MAX_STEP_MINUTES, Math.floor(value)))
}

function clampSimulatedMinute(minute: number) {
  if (!Number.isFinite(minute)) return DEMO_SIM_DAY_START_MINUTE
  return Math.max(
    DEMO_SIM_DAY_START_MINUTE,
    Math.min(DEMO_SIM_DAY_END_MINUTE, Math.floor(minute))
  )
}

function formatSimulatedTime(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  const h = String(hours).padStart(2, "0")
  const m = String(minutes).padStart(2, "0")
  return `${h}:${m}`
}

function isRushHourMinute(minuteOfDay: number) {
  return DEMO_SIM_RUSH_WINDOWS.some(
    window =>
      minuteOfDay >= window.startMinute &&
      minuteOfDay < window.endMinute
  )
}

function demandFactor(minuteOfDay: number) {
  const minute = clampSimulatedMinute(minuteOfDay)
  const daySpan = DEMO_SIM_DAY_END_MINUTE - DEMO_SIM_DAY_START_MINUTE
  const progress =
    daySpan <= 0 ? 0 : (minute - DEMO_SIM_DAY_START_MINUTE) / daySpan
  const broadLunchCurve = 0.46 + 0.24 * Math.sin(progress * Math.PI)
  const morningBump = minute < 10 * 60 ? 0.06 : 0
  const closingDrop = minute >= 16 * 60 ? -0.12 : 0
  const rushBoost = isRushHourMinute(minute) ? 0.34 : 0
  return clampProbability(
    broadLunchCurve + morningBump + closingDrop + rushBoost
  )
}

function queuePressure() {
  return (
    getStationQueue("KITCHEN").length +
    getStationQueue("BAR").length +
    getReadyQueue().length
  )
}

function demoSessionMap() {
  const tenant = getRestaurantContextSlug()
  if (
    !globalForDemoSimulator.__NFC_DEMO_SIM_SESSIONS_BY_TABLE_BY_TENANT__
  ) {
    globalForDemoSimulator.__NFC_DEMO_SIM_SESSIONS_BY_TABLE_BY_TENANT__ = {}
  }
  const mapByTenant =
    globalForDemoSimulator.__NFC_DEMO_SIM_SESSIONS_BY_TABLE_BY_TENANT__
  if (!mapByTenant[tenant]) {
    mapByTenant[tenant] = {}
  }
  return mapByTenant[tenant]
}

function lastRunMap() {
  if (!globalForDemoSimulator.__NFC_DEMO_SIM_LAST_RUN_MS_BY_TENANT__) {
    globalForDemoSimulator.__NFC_DEMO_SIM_LAST_RUN_MS_BY_TENANT__ = {}
  }
  return globalForDemoSimulator.__NFC_DEMO_SIM_LAST_RUN_MS_BY_TENANT__
}

function randomInt(min: number, max: number) {
  const low = Math.ceil(min)
  const high = Math.floor(max)
  return Math.floor(Math.random() * (high - low + 1)) + low
}

function sampleUnique<T>(items: T[], count: number) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }
  return shuffled.slice(0, count)
}

function buildRandomOrderItems(): OrderSubmissionItemDTO[] {
  const menuItems = Array.from(getMenuItemMap().values()).filter(
    item =>
      item.active !== false &&
      (typeof item.stockCount !== "number" || item.stockCount > 0)
  )

  if (menuItems.length === 0) return []

  const lineCount = randomInt(1, Math.min(3, menuItems.length))
  const selected = sampleUnique(menuItems, lineCount)

  return selected.map(item => ({
    itemId: item.id,
    name: item.name,
    quantity: randomInt(1, item.station === "BAR" ? 2 : 3),
    edits: null,
    allergens: item.allergens,
    unitPrice: item.basePrice,
    vatRate: item.vatRate,
    station: item.station,
  }))
}

function spawnDemoOrder() {
  const eligibleTables = listTables().filter(
    table =>
      table.number > 0 &&
      table.number <= DEMO_TABLE_MAX &&
      !table.locked &&
      !table.stale &&
      !table.closed
  )

  if (eligibleTables.length === 0) return false

  const table =
    eligibleTables[Math.floor(Math.random() * eligibleTables.length)]
  const tagId = `${DEMO_TAG_PREFIX}${table.number}`
  assignTag(tagId, table.id)

  const sessionsByTable = demoSessionMap()
  const session = createOrResumeSession({
    sessionId: sessionsByTable[table.number],
    origin: "CUSTOMER",
    tagId,
  })
  sessionsByTable[table.number] = session.id

  const items = buildRandomOrderItems()
  if (items.length === 0) return false

  submitOrder({
    sessionId: session.id,
    tagId,
    items,
    idempotencyKey: `demo-${crypto.randomUUID()}`,
  })
  return true
}

function progressStation(
  station: Station,
  options: {
    minuteOfDay: number
    sliceMinutes: number
  }
) {
  const queue = getStationQueue(station)
  if (queue.length === 0) return false

  const sliceMinutes = Math.max(1, Math.floor(options.sliceMinutes))
  const rush = isRushHourMinute(options.minuteOfDay)
  const queueLoadPenalty = Math.min(0.18, queuePressure() / 90)
  const readyChance = clampProbability(
    0.64 + sliceMinutes * 0.02 + (rush ? -0.06 : 0.04) - queueLoadPenalty
  )

  const candidateTarget =
    Math.max(2, Math.round(sliceMinutes / 3) + (rush ? 1 : 0))
  const candidates = queue.slice(0, Math.min(candidateTarget, queue.length))
  let changed = false

  for (const line of candidates) {
    const prep = markStationPreparing({
      tableNumber: line.tableNumber,
      station,
      lineIds: [line.lineId],
    })
    if (prep.updated > 0) changed = true

    if (Math.random() < readyChance) {
      const ready = markStationSent({
        tableNumber: line.tableNumber,
        station,
        lineIds: [line.lineId],
      })
      if (ready.updated > 0) changed = true
    }
  }

  return changed
}

function deliverReadyLines(options: {
  minuteOfDay: number
  sliceMinutes: number
}) {
  const readyQueue = getReadyQueue()
  if (readyQueue.length === 0) return false

  const sliceMinutes = Math.max(1, Math.floor(options.sliceMinutes))
  const rush = isRushHourMinute(options.minuteOfDay)
  const queueLoadPenalty = Math.min(0.2, queuePressure() / 95)
  const deliverChance = clampProbability(
    0.72 + sliceMinutes * 0.015 + (rush ? -0.05 : 0.03) - queueLoadPenalty
  )

  const deliveryTarget =
    Math.max(2, Math.round(sliceMinutes / 3) + (rush ? 1 : 0))
  let changed = false
  for (const line of readyQueue.slice(0, Math.min(deliveryTarget, readyQueue.length))) {
    if (Math.random() < deliverChance) {
      const delivered = markTableDelivered(line.tableNumber, [line.lineId])
      if (delivered.updated > 0) changed = true
    }
  }
  return changed
}

function runDemandSlice(options: {
  minuteOfDay: number
  sliceMinutes: number
}) {
  let changed = false
  const demand = demandFactor(options.minuteOfDay)
  const spawnAttempts =
    Math.max(1, Math.round(options.sliceMinutes / 3)) +
    (isRushHourMinute(options.minuteOfDay) ? 1 : 0)

  for (let attempt = 0; attempt < spawnAttempts; attempt += 1) {
    const pressure = queuePressure()
    if (pressure >= MAX_PENDING_LINES) break

    const queuePenalty = (pressure / MAX_PENDING_LINES) * 0.5
    const sliceBoost = Math.min(0.28, options.sliceMinutes * 0.02)
    const spawnChance = clampProbability(
      0.14 + demand * 0.66 + sliceBoost - queuePenalty
    )
    if (Math.random() < spawnChance && spawnDemoOrder()) {
      changed = true
    }
  }

  if (progressStation("KITCHEN", options)) changed = true
  if (progressStation("BAR", options)) changed = true
  if (deliverReadyLines(options)) changed = true

  return changed
}

export function getDemoSimulatorStatus(): DemoSimulatorStatus {
  const config = getDemoSimulatorConfig()
  const kitchen = getStationQueue("KITCHEN").length
  const bar = getStationQueue("BAR").length
  const ready = getReadyQueue().length
  const simulatedMinuteOfDay = clampSimulatedMinute(
    config.simulatedMinuteOfDay
  )
  const activeDemoSessions = listSessions().filter(
    session =>
      typeof session.tagId === "string" &&
      session.tagId.startsWith(DEMO_TAG_PREFIX)
  ).length

  return {
    enabled: config.enabled,
    lastTickAt: config.lastTickAt,
    queue: {
      kitchen,
      bar,
      ready,
    },
    activeDemoSessions,
    simulatedMinuteOfDay,
    simulatedTimeLabel: formatSimulatedTime(simulatedMinuteOfDay),
    dayStartMinute: DEMO_SIM_DAY_START_MINUTE,
    dayEndMinute: DEMO_SIM_DAY_END_MINUTE,
    stepMinutes: clampStepMinutes(config.stepMinutes),
    autoMode: config.autoMode === true,
    isRushHour: isRushHourMinute(simulatedMinuteOfDay),
    dayComplete: simulatedMinuteOfDay >= DEMO_SIM_DAY_END_MINUTE,
    rushWindows: DEMO_SIM_RUSH_WINDOWS,
  }
}

export function startDemoSimulator() {
  setDemoSimulatorEnabled(true)
  return getDemoSimulatorStatus()
}

export function stopDemoSimulator() {
  setDemoSimulatorEnabled(false)
  setDemoSimulatorAutoMode(false)
  return getDemoSimulatorStatus()
}

export function resetDemoSimulatorDay() {
  resetDemoSimulatorDayClock()
  return getDemoSimulatorStatus()
}

export function setDemoSimulatorStep(stepMinutes: number) {
  setDemoSimulatorStepMinutes(stepMinutes)
  return getDemoSimulatorStatus()
}

export function setDemoSimulatorAutoRun(autoMode: boolean) {
  setDemoSimulatorAutoMode(autoMode)
  return getDemoSimulatorStatus()
}

export function setDemoSimulatorTime(minuteOfDay: number) {
  setDemoSimulatorClockMinute(minuteOfDay)
  return getDemoSimulatorStatus()
}

export function runDemoSimulatorTick(options?: {
  force?: boolean
  stepMinutes?: number
  advanceClock?: boolean
}): TickResult {
  const config = getDemoSimulatorConfig()
  if (!config.enabled) {
    return {
      ran: false,
      changed: false,
      status: getDemoSimulatorStatus(),
    }
  }

  const nowMs = Date.now()
  const tenant = getRestaurantContextSlug()
  const lastRuns = lastRunMap()
  const lastRunMs =
    lastRuns[tenant] ??
    (config.lastTickAt ? new Date(config.lastTickAt).getTime() : 0)

  if (
    options?.force !== true &&
    Number.isFinite(lastRunMs) &&
    nowMs - lastRunMs < MIN_TICK_INTERVAL_MS
  ) {
    return {
      ran: false,
      changed: false,
      status: getDemoSimulatorStatus(),
    }
  }

  const currentMinute = clampSimulatedMinute(config.simulatedMinuteOfDay)
  if (currentMinute >= DEMO_SIM_DAY_END_MINUTE) {
    if (config.autoMode) {
      setDemoSimulatorAutoMode(false)
    }
    return {
      ran: false,
      changed: false,
      status: getDemoSimulatorStatus(),
    }
  }

  const stepMinutes = clampStepMinutes(
    Number(options?.stepMinutes ?? config.stepMinutes)
  )
  const advanceClock = options?.advanceClock !== false

  lastRuns[tenant] = nowMs
  setDemoSimulatorStepMinutes(stepMinutes)

  let minuteCursor = currentMinute
  let remaining = stepMinutes
  let changed = false

  while (remaining > 0 && minuteCursor < DEMO_SIM_DAY_END_MINUTE) {
    const sliceMinutes = Math.min(5, remaining)
    const sliceChanged = runDemandSlice({
      minuteOfDay: minuteCursor,
      sliceMinutes,
    })
    if (sliceChanged) {
      changed = true
    }
    minuteCursor = Math.min(
      DEMO_SIM_DAY_END_MINUTE,
      minuteCursor + sliceMinutes
    )
    remaining -= sliceMinutes
  }

  if (advanceClock) {
    setDemoSimulatorClockMinute(minuteCursor)
    if (minuteCursor >= DEMO_SIM_DAY_END_MINUTE && config.autoMode) {
      setDemoSimulatorAutoMode(false)
    }
  }

  setDemoSimulatorLastTick(new Date(nowMs).toISOString())
  return {
    ran: true,
    changed,
    status: getDemoSimulatorStatus(),
  }
}

export function runDemoSimulatorBurst(options?: {
  ticks?: number
  force?: boolean
  stepMinutes?: number
  advanceClock?: boolean
}): BurstResult {
  const ticksRequested = Number(options?.ticks ?? 1)
  const ticks = Math.max(1, Math.min(24, Math.floor(ticksRequested)))

  let ran = false
  let changed = false
  let executedTicks = 0
  for (let index = 0; index < ticks; index += 1) {
    const tick = runDemoSimulatorTick({
      force: options?.force ?? true,
      stepMinutes: options?.stepMinutes,
      advanceClock: options?.advanceClock,
    })
    if (!tick.ran) {
      break
    }
    executedTicks += 1
    ran = ran || tick.ran
    changed = changed || tick.changed
  }

  return {
    ran,
    changed,
    ticks: executedTicks,
    status: getDemoSimulatorStatus(),
  }
}
