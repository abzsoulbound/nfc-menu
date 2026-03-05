import { OrderSubmissionItemDTO, Station } from "@/lib/types"
import { getRestaurantContextSlug } from "@/lib/tenantContext"
import {
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
  setDemoSimulatorEnabled,
  setDemoSimulatorLastTick,
  submitOrder,
} from "@/lib/runtimeStore"

const DEMO_TAG_PREFIX = "demo-table-"
const DEMO_TABLE_MAX = 12
const MIN_TICK_INTERVAL_MS = 4500
const MAX_PENDING_LINES = 26

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

function progressStation(station: Station) {
  const queue = getStationQueue(station)
  if (queue.length === 0) return false

  const candidates = queue.slice(0, Math.min(2, queue.length))
  let changed = false

  for (const line of candidates) {
    const prep = markStationPreparing({
      tableNumber: line.tableNumber,
      station,
      lineIds: [line.lineId],
    })
    if (prep.updated > 0) changed = true

    if (Math.random() < 0.75) {
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

function deliverReadyLines() {
  const readyQueue = getReadyQueue()
  if (readyQueue.length === 0) return false

  let changed = false
  for (const line of readyQueue.slice(0, Math.min(2, readyQueue.length))) {
    if (Math.random() < 0.8) {
      const delivered = markTableDelivered(line.tableNumber, [line.lineId])
      if (delivered.updated > 0) changed = true
    }
  }
  return changed
}

export function getDemoSimulatorStatus(): DemoSimulatorStatus {
  const config = getDemoSimulatorConfig()
  const kitchen = getStationQueue("KITCHEN").length
  const bar = getStationQueue("BAR").length
  const ready = getReadyQueue().length
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
  }
}

export function startDemoSimulator() {
  setDemoSimulatorEnabled(true)
  return getDemoSimulatorStatus()
}

export function stopDemoSimulator() {
  setDemoSimulatorEnabled(false)
  return getDemoSimulatorStatus()
}

export function runDemoSimulatorTick(options?: {
  force?: boolean
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

  lastRuns[tenant] = nowMs

  let changed = false
  const queuePressure =
    getStationQueue("KITCHEN").length +
    getStationQueue("BAR").length +
    getReadyQueue().length

  if (queuePressure < MAX_PENDING_LINES && Math.random() < 0.85) {
    if (spawnDemoOrder()) {
      changed = true
    }
  }

  if (progressStation("KITCHEN")) changed = true
  if (progressStation("BAR")) changed = true
  if (deliverReadyLines()) changed = true

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
}): BurstResult {
  const ticksRequested = Number(options?.ticks ?? 1)
  const ticks = Math.max(1, Math.min(24, Math.floor(ticksRequested)))

  let ran = false
  let changed = false
  for (let index = 0; index < ticks; index += 1) {
    const tick = runDemoSimulatorTick({
      force: options?.force ?? true,
    })
    ran = ran || tick.ran
    changed = changed || tick.changed
  }

  return {
    ran,
    changed,
    ticks,
    status: getDemoSimulatorStatus(),
  }
}
