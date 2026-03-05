import { menuSeedForRestaurant } from "@/lib/menuSeed"
import { getRestaurantContextSlug } from "@/lib/tenantContext"
import {
  calculateCartTotals,
  calculateItemPrice,
  calculateVat,
} from "@/lib/pricing"
import {
  AuditEventDTO,
  CustomerAccountDTO,
  CustomerCheckoutQuoteDTO,
  CustomerCheckoutReceiptDTO,
  CustomerNotificationDTO,
  DeliveryChannel,
  DeliveryChannelOrderDTO,
  DeliveryOrderStatus,
  FeedbackDTO,
  FeatureSummaryDTO,
  LoyaltyAccountDTO,
  LoyaltyTier,
  MenuItem,
  MenuDaypartDTO,
  MenuSection,
  OrderPrepState,
  OrderQueueItemDTO,
  PromoCodeDTO,
  PromoCodeKind,
  ReadyQueueItemDTO,
  ReservationDTO,
  ReservationStatus,
  SessionOrderProgressDTO,
  ShiftReportDTO,
  OrderSubmissionItemDTO,
  SessionDTO,
  SessionOrigin,
  TableBillDTO,
  TableBillStatus,
  TablePaymentEntryDTO,
  PrintJobDTO,
  PrintJobStatus,
  Station,
  TableCloseStatus,
  TableDTO,
  TableReviewDTO,
  TagDTO,
  WaitlistEntryDTO,
  WaitlistStatus,
  WalletMethod,
} from "@/lib/types"

type RuntimeHistoryRow = {
  id: string
  data: Record<string, unknown>
  updatedAt: string
}

type RuntimeTable = {
  id: string
  number: number
  locked: boolean
  stale: boolean
  closeStatus: TableCloseStatus
  billStatus: TableBillStatus
  splitCount: number
  openedAt: string
  contributionWindowEndsAt: string
}

type RuntimeTag = {
  id: string
  active: boolean
  tableId: string | null
  lastSeenAt: string
  createdAt: string
}

type RuntimeSession = {
  id: string
  origin: SessionOrigin
  tagId: string | null
  tableId: string | null
  lastActivityAt: string
  createdAt: string
}

type RuntimeOrderItem = {
  lineId: string
  itemId: string
  name: string
  quantity: number
  edits: OrderSubmissionItemDTO["edits"]
  allergens: string[]
  unitPrice: number
  vatRate: number
  station: Station
  kitchenStartedAt: string | null
  kitchenSentAt: string | null
  barStartedAt: string | null
  barSentAt: string | null
  deliveredAt: string | null
  voidedAt: string | null
  voidReason: string | null
  compedAt: string | null
  compReason: string | null
  refireOfLineId: string | null
}

type RuntimeOrder = {
  id: string
  sessionId: string
  tagId: string
  tableId: string
  tableNumber: number
  submittedAt: string
  checkoutSessionId: string | null
  paymentIntentId: string | null
  checkoutStatus: string | null
  items: RuntimeOrderItem[]
}

type RuntimeStaffMessage = {
  id: string
  tableId: string
  target: Station
  message: string
  createdAt: string
}

type RuntimeReprintEvent = {
  id: string
  tableNumber: number
  createdAt: string
}

type RuntimeAuditEvent = AuditEventDTO

type RuntimeTablePayment = TablePaymentEntryDTO

type RuntimePrintJob = {
  id: string
  tableNumber: number
  station: Station
  status: PrintJobStatus
  attempts: number
  reason: string
  note: string | null
  createdAt: string
  updatedAt: string
}

type RuntimeIdempotencyRecord = {
  key: string
  createdAt: string
  response: {
    id: string
    tableNumber: number
    submittedAt: string
    totals: {
      subtotal: number
      vat: number
      total: number
    }
  }
}

type RuntimeCustomerProfile = CustomerAccountDTO
type RuntimeLoyaltyAccount = LoyaltyAccountDTO
type RuntimePromoCode = PromoCodeDTO
type RuntimeReservation = ReservationDTO
type RuntimeWaitlistEntry = WaitlistEntryDTO
type RuntimeNotification = CustomerNotificationDTO
type RuntimeFeedback = FeedbackDTO
type RuntimeDeliveryOrder = DeliveryChannelOrderDTO
type RuntimeMenuDaypart = MenuDaypartDTO
type RuntimeCheckoutReceipt = CustomerCheckoutReceiptDTO

type RuntimeState = {
  history: Record<string, RuntimeHistoryRow>
  tables: RuntimeTable[]
  tags: RuntimeTag[]
  sessions: RuntimeSession[]
  orders: RuntimeOrder[]
  staffMessages: RuntimeStaffMessage[]
  reprints: RuntimeReprintEvent[]
  payments: RuntimeTablePayment[]
  printJobs: RuntimePrintJob[]
  auditTrail: RuntimeAuditEvent[]
  idempotencyRecords: Record<string, RuntimeIdempotencyRecord>
  customerProfiles: RuntimeCustomerProfile[]
  loyaltyAccounts: RuntimeLoyaltyAccount[]
  promos: RuntimePromoCode[]
  reservations: RuntimeReservation[]
  waitlist: RuntimeWaitlistEntry[]
  notifications: RuntimeNotification[]
  feedback: RuntimeFeedback[]
  deliveryOrders: RuntimeDeliveryOrder[]
  menuDayparts: RuntimeMenuDaypart[]
  checkoutReceipts: RuntimeCheckoutReceipt[]
}

const STALE_MS = 30 * 60 * 1000
const CONTRIBUTION_WINDOW_MS = 90 * 60 * 1000
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function nextWindowEnd() {
  return new Date(Date.now() + CONTRIBUTION_WINDOW_MS).toISOString()
}

function asStale(ts: string) {
  return Date.now() - new Date(ts).getTime() > STALE_MS
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function getItemPrepState(item: RuntimeOrderItem): OrderPrepState {
  if (item.deliveredAt) return "DELIVERED"
  const readyAt =
    item.station === "KITCHEN" ? item.kitchenSentAt : item.barSentAt
  if (readyAt) return "READY"
  const startedAt =
    item.station === "KITCHEN" ? item.kitchenStartedAt : item.barStartedAt
  if (startedAt) return "PREPPING"
  return "SUBMITTED"
}

function trimIdempotencyRecords(state: RuntimeState) {
  const now = Date.now()
  for (const [key, value] of Object.entries(state.idempotencyRecords)) {
    if (now - new Date(value.createdAt).getTime() > IDEMPOTENCY_TTL_MS) {
      delete state.idempotencyRecords[key]
    }
  }
}

function createDefaultTables() {
  const now = nowIso()
  const tables: RuntimeTable[] = []
  for (let i = 1; i <= 20; i += 1) {
    tables.push({
      id: crypto.randomUUID(),
      number: i,
      locked: false,
      stale: false,
      closeStatus: "OPEN",
      billStatus: "OPEN",
      splitCount: 1,
      openedAt: now,
      contributionWindowEndsAt: nextWindowEnd(),
    })
  }
  return tables
}

function cloneMenu(menu: MenuSection[]) {
  return menu.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      editableOptions: item.editableOptions
        ? {
            removals: item.editableOptions.removals
              ? [...item.editableOptions.removals]
              : undefined,
            swaps: item.editableOptions.swaps
              ? item.editableOptions.swaps.map(swap => ({ ...swap }))
              : undefined,
            addOns: item.editableOptions.addOns
              ? item.editableOptions.addOns.map(addOn => ({ ...addOn }))
              : undefined,
          }
        : undefined,
    })),
  }))
}

function filterActiveMenu(menu: MenuSection[]) {
  return menu
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.active !== false),
    }))
    .filter(section => section.items.length > 0)
}

function defaultPromos(now: string): RuntimePromoCode[] {
  return [
    {
      code: "WELCOME10",
      description: "10% off orders above £25",
      kind: "PERCENT",
      value: 10,
      minSpend: 25,
      active: true,
      startsAt: now,
      endsAt: null,
      maxUses: null,
      usedCount: 0,
    },
  ]
}

function createInitialState(
  restaurantSlug = getRestaurantContextSlug()
): RuntimeState {
  const now = nowIso()
  const menuSeed = menuSeedForRestaurant(restaurantSlug)
  return {
    history: {
      "menu:current": {
        id: "menu:current",
        data: { menu: cloneMenu(menuSeed) },
        updatedAt: now,
      },
      "system:flags": {
        id: "system:flags",
        data: { serviceActive: false },
        updatedAt: now,
      },
      "demo:simulator": {
        id: "demo:simulator",
        data: { enabled: false, lastTickAt: null },
        updatedAt: now,
      },
    },
    tables: createDefaultTables(),
    tags: [],
    sessions: [],
    orders: [],
    staffMessages: [],
    reprints: [],
    payments: [],
    printJobs: [],
    auditTrail: [],
    idempotencyRecords: {},
    customerProfiles: [],
    loyaltyAccounts: [],
    promos: defaultPromos(now),
    reservations: [],
    waitlist: [],
    notifications: [],
    feedback: [],
    deliveryOrders: [],
    menuDayparts: [],
    checkoutReceipts: [],
  }
}

const globalForRuntime = globalThis as unknown as {
  __NFC_RUNTIME_STATES__?: Record<string, RuntimeState>
}

function stateMap() {
  if (!globalForRuntime.__NFC_RUNTIME_STATES__) {
    globalForRuntime.__NFC_RUNTIME_STATES__ = {}
  }
  return globalForRuntime.__NFC_RUNTIME_STATES__
}

function normalizeRuntimeState(
  input: unknown,
  restaurantSlug = getRestaurantContextSlug()
): RuntimeState {
  const fallback = createInitialState(restaurantSlug)
  if (!isPlainObject(input)) return fallback

  const state = input as Partial<RuntimeState>
  const history = isPlainObject(state.history)
    ? (state.history as Record<string, RuntimeHistoryRow>)
    : fallback.history
  const tables = Array.isArray(state.tables)
    ? (state.tables as RuntimeTable[]).map(table => ({
        ...table,
        billStatus: table.billStatus ?? "OPEN",
        splitCount:
          typeof table.splitCount === "number" &&
          Number.isFinite(table.splitCount) &&
          table.splitCount > 0
            ? Math.floor(table.splitCount)
            : 1,
      }))
    : fallback.tables
  const tags = Array.isArray(state.tags)
    ? (state.tags as RuntimeTag[])
    : fallback.tags
  const sessions = Array.isArray(state.sessions)
    ? (state.sessions as RuntimeSession[])
    : fallback.sessions
  const ordersRaw = Array.isArray(state.orders)
    ? (state.orders as RuntimeOrder[])
    : fallback.orders
  const orders = ordersRaw.map(order => ({
    ...order,
    checkoutSessionId: order.checkoutSessionId ?? null,
    paymentIntentId: order.paymentIntentId ?? null,
    checkoutStatus: order.checkoutStatus ?? null,
    items: order.items.map(item => ({
      ...item,
      lineId: item.lineId ?? crypto.randomUUID(),
      kitchenStartedAt: item.kitchenStartedAt ?? null,
      barStartedAt: item.barStartedAt ?? null,
      deliveredAt: item.deliveredAt ?? null,
      voidedAt: item.voidedAt ?? null,
      voidReason: item.voidReason ?? null,
      compedAt: item.compedAt ?? null,
      compReason: item.compReason ?? null,
      refireOfLineId: item.refireOfLineId ?? null,
    })),
  }))
  const staffMessages = Array.isArray(state.staffMessages)
    ? (state.staffMessages as RuntimeStaffMessage[])
    : fallback.staffMessages
  const reprints = Array.isArray(state.reprints)
    ? (state.reprints as RuntimeReprintEvent[])
    : fallback.reprints
  const payments = Array.isArray(state.payments)
    ? (state.payments as RuntimeTablePayment[])
    : []
  const printJobs = Array.isArray(state.printJobs)
    ? (state.printJobs as RuntimePrintJob[])
    : []
  const auditTrail = Array.isArray(state.auditTrail)
    ? (state.auditTrail as RuntimeAuditEvent[])
    : []
  const idempotencyRecords = isPlainObject(state.idempotencyRecords)
    ? (state.idempotencyRecords as Record<string, RuntimeIdempotencyRecord>)
    : {}
  const customerProfiles = Array.isArray(state.customerProfiles)
    ? (state.customerProfiles as RuntimeCustomerProfile[])
    : fallback.customerProfiles
  const loyaltyAccounts = Array.isArray(state.loyaltyAccounts)
    ? (state.loyaltyAccounts as RuntimeLoyaltyAccount[])
    : fallback.loyaltyAccounts
  const promos = Array.isArray(state.promos)
    ? (state.promos as RuntimePromoCode[])
    : fallback.promos
  const reservations = Array.isArray(state.reservations)
    ? (state.reservations as RuntimeReservation[])
    : fallback.reservations
  const waitlist = Array.isArray(state.waitlist)
    ? (state.waitlist as RuntimeWaitlistEntry[])
    : fallback.waitlist
  const notifications = Array.isArray(state.notifications)
    ? (state.notifications as RuntimeNotification[])
    : fallback.notifications
  const feedback = Array.isArray(state.feedback)
    ? (state.feedback as RuntimeFeedback[])
    : fallback.feedback
  const deliveryOrders = Array.isArray(state.deliveryOrders)
    ? (state.deliveryOrders as RuntimeDeliveryOrder[])
    : fallback.deliveryOrders
  const menuDayparts = Array.isArray(state.menuDayparts)
    ? (state.menuDayparts as RuntimeMenuDaypart[])
    : fallback.menuDayparts
  const checkoutReceipts = Array.isArray(state.checkoutReceipts)
    ? (state.checkoutReceipts as RuntimeCheckoutReceipt[])
    : fallback.checkoutReceipts

  return {
    history,
    tables,
    tags,
    sessions,
    orders,
    staffMessages,
    reprints,
    payments,
    printJobs,
    auditTrail,
    idempotencyRecords,
    customerProfiles,
    loyaltyAccounts,
    promos,
    reservations,
    waitlist,
    notifications,
    feedback,
    deliveryOrders,
    menuDayparts,
    checkoutReceipts,
  }
}

function getState(restaurantSlug = getRestaurantContextSlug()) {
  const states = stateMap()
  if (!states[restaurantSlug]) {
    states[restaurantSlug] = createInitialState(restaurantSlug)
  }
  trimIdempotencyRecords(states[restaurantSlug])
  return states[restaurantSlug]
}

export function exportRuntimeStateSnapshot(restaurantSlug?: string) {
  return JSON.parse(
    JSON.stringify(getState(restaurantSlug))
  ) as RuntimeState
}

export function importRuntimeStateSnapshot(
  snapshot: unknown,
  restaurantSlug?: string
) {
  const slug = restaurantSlug ?? getRestaurantContextSlug()
  stateMap()[slug] = normalizeRuntimeState(snapshot, slug)
}

function findMenuItem(itemId: string) {
  const snapshot = getMenuSnapshot({ includeInactive: true })
  for (const section of snapshot.menu) {
    const item = section.items.find(x => x.id === itemId)
    if (item) return item
  }
  return null
}

function findTableById(tableId: string) {
  return getState().tables.find(t => t.id === tableId) ?? null
}

function findTagById(tagId: string) {
  return getState().tags.find(t => t.id === tagId) ?? null
}

function findOrderLine(lineId: string) {
  for (const order of getState().orders) {
    const line = order.items.find(item => item.lineId === lineId)
    if (line) {
      return { order, line }
    }
  }
  return null
}

function lineBaseTotal(line: RuntimeOrderItem) {
  return line.unitPrice * line.quantity
}

function lineEffectiveTotal(line: RuntimeOrderItem) {
  if (line.voidedAt) return 0
  if (line.compedAt) return 0
  return lineBaseTotal(line)
}

function getTableLines(tableId: string) {
  return getState().orders
    .filter(order => order.tableId === tableId)
    .flatMap(order => order.items)
}

function getTablePaymentEntries(tableId: string) {
  return getState().payments
    .filter(entry => entry.tableId === tableId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getTablePaidTotal(tableId: string) {
  return getTablePaymentEntries(tableId).reduce(
    (sum, entry) => sum + entry.amount,
    0
  )
}

function tableBillTotals(table: RuntimeTable) {
  const lines = getTableLines(table.id)
  const subtotal = lines.reduce(
    (sum, line) => sum + lineEffectiveTotal(line),
    0
  )
  const vat = lines.reduce((sum, line) => {
    if (line.voidedAt || line.compedAt) return sum
    return sum + calculateVat(line.unitPrice * line.quantity, line.vatRate)
  }, 0)
  const total = Number(subtotal.toFixed(2))
  const paidTotal = Number(getTablePaidTotal(table.id).toFixed(2))
  const dueTotal = Number(Math.max(total - paidTotal, 0).toFixed(2))

  let status: TableBillStatus = table.billStatus
  if (total <= 0 && paidTotal <= 0) {
    status = "OPEN"
  } else if (paidTotal >= total && total > 0) {
    status = "PAID"
  } else if (paidTotal > 0 && paidTotal < total) {
    status = "PARTIAL"
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    vat: Number(vat.toFixed(2)),
    total,
    paidTotal,
    dueTotal,
    status,
  }
}

function isTakeawayTag(tagId: string) {
  return tagId.trim().toLowerCase() === "takeaway"
}

function toTableDTO(table: RuntimeTable): TableDTO {
  const stale =
    table.stale ||
    Date.now() > new Date(table.contributionWindowEndsAt).getTime()
  const bill = tableBillTotals(table)

  return {
    id: table.id,
    number: table.number,
    locked: table.locked,
    stale,
    closed: table.closeStatus !== "OPEN",
    paid: table.closeStatus === "PAID",
    openedAt: table.openedAt,
    contributionWindowEndsAt: table.contributionWindowEndsAt,
    billStatus: bill.status,
    billTotal: bill.total,
    paidTotal: bill.paidTotal,
    splitCount: table.splitCount,
  }
}

function touchSession(session: RuntimeSession, tagId?: string) {
  session.lastActivityAt = nowIso()
  if (tagId && !isTakeawayTag(tagId)) {
    session.tagId = tagId
    const tag = registerTagScan(tagId)
    session.tableId = tag.tableId
  }
}

function findTableByNumber(tableNumber: number) {
  return getState().tables.find(table => table.number === tableNumber) ?? null
}

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized === "" ? null : normalized
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.replace(/\s+/g, "").trim()
  return normalized === "" ? null : normalized
}

function normalizeCustomerReference(input: {
  customerId?: string | null
  email?: string | null
  phone?: string | null
}) {
  if (input.customerId && input.customerId.trim() !== "") {
    return input.customerId.trim()
  }

  const email = normalizeEmail(input.email)
  if (email) return `email:${email}`

  const phone = normalizePhone(input.phone)
  if (phone) return `phone:${phone}`

  return null
}

function resolveLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 500) return "GOLD"
  if (points >= 200) return "SILVER"
  return "BRONZE"
}

function getOrCreateCustomerProfile(input: {
  customerId?: string | null
  email?: string | null
  phone?: string | null
  name?: string | null
  marketingOptIn?: boolean
}) {
  const state = getState()
  const customerId = normalizeCustomerReference(input)
  if (!customerId) return null

  const now = nowIso()
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  const name = input.name?.trim() || null

  let profile = state.customerProfiles.find(p => p.id === customerId) ?? null
  if (!profile) {
    profile = {
      id: customerId,
      name,
      email,
      phone,
      marketingOptIn: input.marketingOptIn === true,
      favoriteItemIds: [],
      createdAt: now,
      lastSeenAt: now,
    }
    state.customerProfiles.push(profile)
    return profile
  }

  profile.lastSeenAt = now
  if (name) profile.name = name
  if (email) profile.email = email
  if (phone) profile.phone = phone
  if (typeof input.marketingOptIn === "boolean") {
    profile.marketingOptIn = input.marketingOptIn
  }

  return profile
}

function getOrCreateLoyaltyAccount(customerId: string) {
  const state = getState()
  const now = nowIso()

  let account =
    state.loyaltyAccounts.find(entry => entry.customerId === customerId) ??
    null
  if (!account) {
    account = {
      customerId,
      points: 0,
      lifetimeSpend: 0,
      tier: "BRONZE",
      lastUpdatedAt: now,
    }
    state.loyaltyAccounts.push(account)
  }
  return account
}

function touchLoyaltyAccount(account: RuntimeLoyaltyAccount) {
  account.tier = resolveLoyaltyTier(account.points)
  account.lastUpdatedAt = nowIso()
}

function isPromoWindowActive(
  promo: RuntimePromoCode,
  at: Date = new Date()
) {
  const startsAt = promo.startsAt ? new Date(promo.startsAt).getTime() : null
  const endsAt = promo.endsAt ? new Date(promo.endsAt).getTime() : null
  const atMs = at.getTime()

  if (startsAt && atMs < startsAt) return false
  if (endsAt && atMs > endsAt) return false
  return true
}

function calculatePromoDiscount(input: {
  promo: RuntimePromoCode
  subtotal: number
}) {
  if (input.subtotal < input.promo.minSpend) return 0

  if (input.promo.kind === "PERCENT") {
    const ratio = input.promo.value / 100
    return Number((input.subtotal * ratio).toFixed(2))
  }
  return Number(Math.min(input.promo.value, input.subtotal).toFixed(2))
}

function validateTimeString(value: string, label: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${label} must be HH:MM`)
  }
  const [hoursRaw, minutesRaw] = value.split(":")
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${label} must be HH:MM`)
  }
}

function toMinutesFromTimeString(value: string) {
  const [hoursRaw, minutesRaw] = value.split(":")
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  return hours * 60 + minutes
}

function isDaypartActive(daypart: RuntimeMenuDaypart, at: Date = new Date()) {
  if (!daypart.enabled) return false
  const day = at.getDay()
  if (!daypart.days.includes(day)) return false

  const minutes = at.getHours() * 60 + at.getMinutes()
  const start = toMinutesFromTimeString(daypart.startTime)
  const end = toMinutesFromTimeString(daypart.endTime)

  if (start <= end) {
    return minutes >= start && minutes <= end
  }

  // Overnight window.
  return minutes >= start || minutes <= end
}

export function getMenuSnapshot(): {
  menu: MenuSection[]
  locked: boolean
}
export function getMenuSnapshot(options: {
  includeInactive: true
}): {
  menu: MenuSection[]
  locked: boolean
}
export function getMenuSnapshot(options?: {
  includeInactive?: boolean
}): {
  menu: MenuSection[]
  locked: boolean
} {
  const state = getState()
  const includeInactive = options?.includeInactive === true
  const menuRaw = Array.isArray(state.history["menu:current"]?.data?.menu)
    ? (state.history["menu:current"].data.menu as MenuSection[])
    : []
  let menu = includeInactive ? menuRaw : filterActiveMenu(menuRaw)

  if (!includeInactive) {
    const activeDayparts = state.menuDayparts.filter(entry =>
      isDaypartActive(entry)
    )

    if (activeDayparts.length > 0) {
      const allowedSectionIds = new Set<string>()
      const allowedItemIds = new Set<string>()

      for (const daypart of activeDayparts) {
        for (const sectionId of daypart.sectionIds) {
          allowedSectionIds.add(sectionId)
        }
        for (const itemId of daypart.itemIds) {
          allowedItemIds.add(itemId)
        }
      }

      if (allowedSectionIds.size > 0 || allowedItemIds.size > 0) {
        menu = menu
          .map(section => {
            if (allowedSectionIds.has(section.id)) {
              return section
            }
            return {
              ...section,
              items: section.items.filter(item =>
                allowedItemIds.has(item.id)
              ),
            }
          })
          .filter(section => section.items.length > 0)
      }
    }
  }

  const locked = state.history["system:flags"]?.data?.serviceActive === true
  return { menu, locked }
}

export function getSystemFlags() {
  return {
    serviceLocked:
      getState().history["system:flags"]?.data?.serviceActive === true,
  }
}

export type DemoSimulatorConfig = {
  enabled: boolean
  lastTickAt: string | null
}

function demoSimulatorConfigFromState(state: RuntimeState): DemoSimulatorConfig {
  const raw = state.history["demo:simulator"]?.data
  if (!isPlainObject(raw)) {
    return {
      enabled: false,
      lastTickAt: null,
    }
  }

  return {
    enabled: raw.enabled === true,
    lastTickAt:
      typeof raw.lastTickAt === "string" ? raw.lastTickAt : null,
  }
}

export function getDemoSimulatorConfig(): DemoSimulatorConfig {
  return demoSimulatorConfigFromState(getState())
}

export function setDemoSimulatorEnabled(enabled: boolean) {
  const state = getState()
  const current = demoSimulatorConfigFromState(state)

  if (current.enabled === enabled) {
    return current
  }

  state.history["demo:simulator"] = {
    id: "demo:simulator",
    data: {
      enabled,
      lastTickAt: current.lastTickAt,
    },
    updatedAt: nowIso(),
  }

  return {
    enabled,
    lastTickAt: current.lastTickAt,
  }
}

export function setDemoSimulatorLastTick(lastTickAt: string) {
  const state = getState()
  const current = demoSimulatorConfigFromState(state)

  state.history["demo:simulator"] = {
    id: "demo:simulator",
    data: {
      enabled: current.enabled,
      lastTickAt,
    },
    updatedAt: nowIso(),
  }

  return {
    enabled: current.enabled,
    lastTickAt,
  }
}

export function setServiceActive(serviceActive: boolean) {
  const state = getState()
  const currentFlags = isPlainObject(state.history["system:flags"]?.data)
    ? state.history["system:flags"].data
    : {}
  state.history["system:flags"] = {
    id: "system:flags",
    data: {
      ...currentFlags,
      serviceActive,
    },
    updatedAt: nowIso(),
  }
}

export function appendAuditEvent(
  event: Omit<RuntimeAuditEvent, "id" | "createdAt">
) {
  const record: RuntimeAuditEvent = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    ...event,
  }
  const state = getState()
  state.auditTrail.unshift(record)
  if (state.auditTrail.length > 1000) {
    state.auditTrail = state.auditTrail.slice(0, 1000)
  }
  return record
}

export function listAuditEvents(limit = 100): RuntimeAuditEvent[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100
  return getState().auditTrail.slice(0, safeLimit)
}

export function updateMenuItem(input: {
  itemId: string
  patch: Partial<
    Pick<
      MenuItem,
      | "name"
      | "description"
      | "image"
      | "basePrice"
      | "station"
      | "active"
      | "stockCount"
    >
  >
}) {
  const state = getState()
  const menuRaw = Array.isArray(state.history["menu:current"]?.data?.menu)
    ? (state.history["menu:current"].data.menu as MenuSection[])
    : []

  let updated: MenuItem | null = null
  for (const section of menuRaw) {
    const index = section.items.findIndex(item => item.id === input.itemId)
    if (index < 0) continue

    const current = section.items[index]
    const next: MenuItem = {
      ...current,
      ...input.patch,
    }

    if (typeof next.name !== "string" || next.name.trim() === "") {
      throw new Error("Item name is required")
    }
    if (
      typeof next.description !== "string" ||
      next.description.trim() === ""
    ) {
      throw new Error("Item description is required")
    }
    if (
      next.image !== null &&
      typeof next.image !== "string"
    ) {
      throw new Error("image must be a string or null")
    }
    if (!Number.isFinite(next.basePrice) || next.basePrice < 0) {
      throw new Error("basePrice must be a non-negative number")
    }
    if (next.station !== "KITCHEN" && next.station !== "BAR") {
      throw new Error("station must be KITCHEN or BAR")
    }
    if (
      typeof next.stockCount === "number" &&
      (!Number.isFinite(next.stockCount) || next.stockCount < 0)
    ) {
      throw new Error("stockCount must be null or a non-negative number")
    }

    if (typeof next.stockCount === "number") {
      next.stockCount = Math.floor(next.stockCount)
      if (next.stockCount <= 0) {
        next.active = false
      } else if (next.active === false) {
        next.active = true
      }
    }

    section.items[index] = next
    updated = next
    break
  }

  if (!updated) {
    throw new Error("Menu item not found")
  }

  state.history["menu:current"] = {
    id: "menu:current",
    data: { menu: menuRaw },
    updatedAt: nowIso(),
  }

  return updated
}

export function setMenuItemAvailability(itemId: string, active: boolean) {
  return updateMenuItem({
    itemId,
    patch: { active },
  })
}

export function setMenuItemImage(
  itemId: string,
  image: string | null
) {
  return updateMenuItem({
    itemId,
    patch: { image },
  })
}

export function setMenuItemStock(
  itemId: string,
  stockCount: number | null
) {
  if (stockCount !== null) {
    if (!Number.isFinite(stockCount) || stockCount < 0) {
      throw new Error("stockCount must be null or non-negative")
    }
  }

  return updateMenuItem({
    itemId,
    patch: {
      stockCount:
        stockCount === null ? null : Math.floor(stockCount),
    },
  })
}

export function adjustMenuItemStock(itemId: string, delta: number) {
  if (!Number.isFinite(delta)) {
    throw new Error("delta must be numeric")
  }
  const item = findMenuItem(itemId)
  if (!item) {
    throw new Error("Menu item not found")
  }
  if (typeof item.stockCount !== "number") {
    throw new Error("Cannot adjust stock for unlimited item")
  }

  const current = item.stockCount
  const next = Math.max(0, Math.floor(current + delta))
  return setMenuItemStock(itemId, next)
}

export function renameMenuSection(sectionId: string, name: string) {
  const state = getState()
  const menuRaw = Array.isArray(state.history["menu:current"]?.data?.menu)
    ? (state.history["menu:current"].data.menu as MenuSection[])
    : []

  const section = menuRaw.find(item => item.id === sectionId)
  if (!section) {
    throw new Error("Menu section not found")
  }
  const nextName = name.trim()
  if (!nextName) {
    throw new Error("Section name is required")
  }

  section.name = nextName
  state.history["menu:current"] = {
    id: "menu:current",
    data: { menu: menuRaw },
    updatedAt: nowIso(),
  }

  return section
}

export function resetMenuToDefault() {
  const slug = getRestaurantContextSlug()
  const state = getState(slug)
  const menu = cloneMenu(menuSeedForRestaurant(slug))
  state.history["menu:current"] = {
    id: "menu:current",
    data: { menu },
    updatedAt: nowIso(),
  }
  return menu
}

export function replaceMenu(menu: MenuSection[]) {
  if (!Array.isArray(menu) || menu.length === 0) {
    throw new Error("Menu must contain at least one section")
  }

  const sectionIds = new Set<string>()
  const itemIds = new Set<string>()

  const normalizedMenu = menu.map((section, sectionIndex) => {
    const sectionId = section.id?.trim()
    const sectionName = section.name?.trim()

    if (!sectionId) {
      throw new Error(
        `Section ${sectionIndex + 1} is missing an id`
      )
    }
    if (!sectionName) {
      throw new Error(
        `Section ${sectionIndex + 1} is missing a name`
      )
    }
    if (sectionIds.has(sectionId)) {
      throw new Error(`Duplicate section id: ${sectionId}`)
    }
    sectionIds.add(sectionId)

    if (!Array.isArray(section.items) || section.items.length === 0) {
      throw new Error(
        `Section ${sectionName} must include at least one item`
      )
    }

    const items = section.items.map((item, itemIndex) => {
      const itemId = item.id?.trim()
      const itemName = item.name?.trim()
      const description = item.description?.trim()

      if (!itemId) {
        throw new Error(
          `Item ${itemIndex + 1} in section ${sectionName} is missing an id`
        )
      }
      if (!itemName) {
        throw new Error(`Item ${itemId} is missing a name`)
      }
      if (!description) {
        throw new Error(`Item ${itemId} is missing a description`)
      }
      if (itemIds.has(itemId)) {
        throw new Error(`Duplicate item id: ${itemId}`)
      }
      itemIds.add(itemId)

      if (!Number.isFinite(item.basePrice) || item.basePrice < 0) {
        throw new Error(
          `Item ${itemId} has an invalid base_price`
        )
      }
      if (!Number.isFinite(item.vatRate) || item.vatRate < 0) {
        throw new Error(
          `Item ${itemId} has an invalid vat_rate`
        )
      }
      if (item.station !== "KITCHEN" && item.station !== "BAR") {
        throw new Error(
          `Item ${itemId} has an invalid station`
        )
      }

      let stockCount: number | null = null
      if (
        item.stockCount !== undefined &&
        item.stockCount !== null
      ) {
        if (
          !Number.isFinite(item.stockCount) ||
          item.stockCount < 0
        ) {
          throw new Error(
            `Item ${itemId} has an invalid stock_count`
          )
        }
        stockCount = Math.floor(item.stockCount)
      }

      const allergens = Array.isArray(item.allergens)
        ? item.allergens
            .filter(
              (value): value is string =>
                typeof value === "string" &&
                value.trim() !== ""
            )
            .map(value => value.trim())
        : []

      const normalizedItem: MenuItem = {
        id: itemId,
        name: itemName,
        description,
        image:
          typeof item.image === "string" ? item.image : null,
        basePrice: Number(item.basePrice.toFixed(2)),
        vatRate: Number(item.vatRate.toFixed(4)),
        allergens,
        active:
          stockCount === 0 ? false : item.active !== false,
        stockCount,
        editableOptions: item.editableOptions,
        station: item.station,
      }

      return normalizedItem
    })

    return {
      id: sectionId,
      name: sectionName,
      items,
    }
  })

  const state = getState()
  state.history["menu:current"] = {
    id: "menu:current",
    data: { menu: normalizedMenu },
    updatedAt: nowIso(),
  }

  return normalizedMenu
}

export function reopenTable(tableId: string) {
  const state = getState()
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }

  table.closeStatus = "OPEN"
  table.billStatus = "OPEN"
  table.splitCount = 1
  table.locked = false
  table.stale = false
  table.openedAt = nowIso()
  table.contributionWindowEndsAt = nextWindowEnd()
  state.payments = state.payments.filter(entry => entry.tableId !== tableId)

  return toTableDTO(table)
}

export function resetTableContributionWindow(tableId: string) {
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }

  table.stale = false
  table.contributionWindowEndsAt = nextWindowEnd()
  return toTableDTO(table)
}

export function transferTableData(input: {
  sourceTableId: string
  targetTableId: string
  mode: "TRANSFER" | "MERGE" | "SPLIT_ADDONS"
}) {
  const state = getState()
  const source = findTableById(input.sourceTableId)
  const target = findTableById(input.targetTableId)
  if (!source || !target) {
    throw new Error("Source and target tables must exist")
  }
  if (source.id === target.id) {
    throw new Error("Source and target tables must be different")
  }

  const sourceOrders = state.orders
    .filter(order => order.tableId === source.id)
    .sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() -
        new Date(b.submittedAt).getTime()
    )

  const ordersToMove =
    input.mode === "SPLIT_ADDONS"
      ? sourceOrders.slice(1)
      : sourceOrders

  for (const order of ordersToMove) {
    order.tableId = target.id
    order.tableNumber = target.number
  }

  if (input.mode !== "SPLIT_ADDONS") {
    for (const tag of state.tags) {
      if (tag.tableId === source.id) {
        tag.tableId = target.id
        tag.lastSeenAt = nowIso()
      }
    }

    for (const session of state.sessions) {
      if (session.tableId === source.id) {
        session.tableId = target.id
        session.lastActivityAt = nowIso()
      }
    }

    for (const payment of state.payments) {
      if (payment.tableId === source.id) {
        payment.tableId = target.id
      }
    }
  }

  if (input.mode === "MERGE") {
    source.closeStatus = "PAID"
    source.billStatus = "PAID"
    source.locked = true
    source.stale = false
  }

  return {
    movedOrders: ordersToMove.length,
    sourceTableNumber: source.number,
    targetTableNumber: target.number,
    mode: input.mode,
  }
}

export function resetRuntimeState() {
  const slug = getRestaurantContextSlug()
  stateMap()[slug] = createInitialState(slug)
  return { ok: true }
}

export function listTables() {
  return getState().tables
    .slice()
    .sort((a, b) => a.number - b.number)
    .map(toTableDTO)
}

export function getTable(tableId: string) {
  const table = findTableById(tableId)
  return table ? toTableDTO(table) : null
}

export function getTableBill(tableId: string): TableBillDTO {
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }

  const totals = tableBillTotals(table)
  const entries = getTablePaymentEntries(tableId)

  return {
    tableId: table.id,
    tableNumber: table.number,
    subtotal: totals.subtotal,
    vat: totals.vat,
    total: totals.total,
    paidTotal: totals.paidTotal,
    dueTotal: totals.dueTotal,
    splitCount: table.splitCount,
    status: totals.status,
    entries,
  }
}

export function openTableBill(tableId: string) {
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }
  table.billStatus = "OPEN"
  table.closeStatus = "OPEN"
  table.locked = false
  return getTableBill(tableId)
}

export function splitTableBill(tableId: string, splitCount: number) {
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }
  if (!Number.isFinite(splitCount) || splitCount < 1) {
    throw new Error("splitCount must be >= 1")
  }
  table.splitCount = Math.max(1, Math.floor(splitCount))
  return getTableBill(tableId)
}

export function addTablePayment(input: {
  tableId: string
  amount: number
  method?: string
  note?: string
}) {
  const table = findTableById(input.tableId)
  if (!table) {
    throw new Error("Unknown table")
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero")
  }

  const entry: RuntimeTablePayment = {
    id: crypto.randomUUID(),
    tableId: input.tableId,
    amount: Number(input.amount.toFixed(2)),
    method: input.method?.trim() || "manual",
    status: "PAID",
    note: input.note?.trim() || undefined,
    createdAt: nowIso(),
  }
  getState().payments.push(entry)

  const bill = getTableBill(input.tableId)
  if (bill.paidTotal >= bill.total && bill.total > 0) {
    table.billStatus = "PAID"
    table.closeStatus = "PAID"
    table.locked = true
  } else if (bill.paidTotal > 0) {
    table.billStatus = "PARTIAL"
    table.closeStatus = "OPEN"
  }

  return getTableBill(input.tableId)
}

export function addTableRefund(input: {
  tableId: string
  amount: number
  method?: string
  note?: string
}) {
  const table = findTableById(input.tableId)
  if (!table) {
    throw new Error("Unknown table")
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Refund amount must be greater than zero")
  }

  const entry: RuntimeTablePayment = {
    id: crypto.randomUUID(),
    tableId: input.tableId,
    amount: Number((input.amount * -1).toFixed(2)),
    method: input.method?.trim() || "refund",
    status: "UNPAID",
    note: input.note?.trim() || "Refund",
    createdAt: nowIso(),
  }
  getState().payments.push(entry)

  const bill = getTableBill(input.tableId)
  if (bill.paidTotal >= bill.total && bill.total > 0) {
    table.billStatus = "PAID"
    table.closeStatus = "PAID"
    table.locked = true
  } else if (bill.paidTotal > 0) {
    table.billStatus = "PARTIAL"
    table.closeStatus = "OPEN"
    table.locked = false
  } else {
    table.billStatus = "OPEN"
    table.closeStatus = "OPEN"
    table.locked = false
  }

  return getTableBill(input.tableId)
}

export function markTableBillStatus(
  tableId: string,
  status: TableBillStatus
) {
  const table = findTableById(tableId)
  if (!table) {
    throw new Error("Unknown table")
  }

  table.billStatus = status
  if (status === "PAID") {
    table.closeStatus = "PAID"
    table.locked = true
  } else if (status === "UNPAID") {
    table.closeStatus = "UNPAID"
    table.locked = true
  } else {
    table.closeStatus = "OPEN"
    table.locked = false
  }

  return getTableBill(tableId)
}

export function getCustomerCheckoutQuoteByTableNumber(
  tableNumber: number
): CustomerCheckoutQuoteDTO {
  if (!Number.isFinite(tableNumber) || tableNumber < 0) {
    throw new Error("tableNumber must be a non-negative number")
  }

  const table = findTableByNumber(Math.floor(tableNumber))
  if (!table) {
    throw new Error("Unknown table number")
  }

  const bill = getTableBill(table.id)
  const suggestedShareAmount =
    bill.dueTotal > 0
      ? Number((bill.dueTotal / Math.max(1, table.splitCount)).toFixed(2))
      : 0

  return {
    tableId: table.id,
    tableNumber: table.number,
    dueTotal: bill.dueTotal,
    splitCount: table.splitCount,
    suggestedShareAmount,
  }
}

export type PreparedCustomerCheckoutInput = {
  tableId: string
  tableNumber: number
  amount: number
  tipAmount: number
  totalCharged: number
  method: WalletMethod
  email?: string | null
  promoCode?: string | null
  promoDiscount?: number
  customerId?: string | null
  customerName?: string | null
  phone?: string | null
  marketingOptIn?: boolean
  redeemedPoints?: number
  loyaltyEarnedPoints?: number
  idempotencyKey?: string
}

export function readExistingCheckoutReplay(
  idempotencyKey?: string | null
) {
  const scopedIdempotencyKey = idempotencyKey
    ? `checkout:${idempotencyKey}`
    : null

  if (!scopedIdempotencyKey) {
    return null
  }

  const existing = getState().idempotencyRecords[scopedIdempotencyKey]
  if (!existing) {
    return null
  }

  const existingResponse = existing.response as unknown as {
    quote: CustomerCheckoutQuoteDTO
    bill: TableBillDTO
    receipt: RuntimeCheckoutReceipt
    promoDiscount: number
    idempotencyReplay?: boolean
  }

  return {
    scopedIdempotencyKey,
    response: {
      ...existingResponse,
      idempotencyReplay: true,
    },
  }
}

function storeCheckoutReplay(
  scopedIdempotencyKey: string | null,
  response: {
    quote: CustomerCheckoutQuoteDTO
    bill: TableBillDTO
    receipt: RuntimeCheckoutReceipt
    promoDiscount: number
    idempotencyReplay?: boolean
  }
) {
  if (!scopedIdempotencyKey) {
    return
  }

  getState().idempotencyRecords[scopedIdempotencyKey] = {
    key: scopedIdempotencyKey,
    createdAt: nowIso(),
    response:
      response as unknown as RuntimeIdempotencyRecord["response"],
  }
}

export function previewCustomerCheckout(input: {
  tableNumber: number
  shareCount?: number
  amount?: number
  tipPercent?: number
  method: WalletMethod
  email?: string | null
  promoCode?: string | null
  customerId?: string | null
  customerName?: string | null
  phone?: string | null
  marketingOptIn?: boolean
  redeemPoints?: number
  idempotencyKey?: string
}) {
  const table = findTableByNumber(Math.floor(input.tableNumber))
  if (!table) {
    throw new Error("Unknown table number")
  }

  const bill = getTableBill(table.id)
  if (bill.dueTotal <= 0) {
    throw new Error("No outstanding amount due")
  }

  const shareCount =
    Number.isFinite(input.shareCount) && (input.shareCount ?? 1) > 0
      ? Math.floor(input.shareCount as number)
      : 1

  const requestedAmount =
    typeof input.amount === "number" && Number.isFinite(input.amount)
      ? Number(input.amount.toFixed(2))
      : Number((bill.dueTotal / shareCount).toFixed(2))

  if (requestedAmount <= 0) {
    throw new Error("Payment amount must be greater than zero")
  }

  let amount = Number(Math.min(requestedAmount, bill.dueTotal).toFixed(2))

  let promoDiscount = 0
  const promoCode = input.promoCode?.trim().toUpperCase() || null
  if (promoCode) {
    const promo =
      getState().promos.find(entry => entry.code === promoCode) ?? null
    if (!promo || !promo.active || !isPromoWindowActive(promo)) {
      throw new Error("Promo code is not active")
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new Error("Promo code usage limit reached")
    }
    promoDiscount = calculatePromoDiscount({
      promo,
      subtotal: amount,
    })
    amount = Number(Math.max(amount - promoDiscount, 0).toFixed(2))
  }

  const customerReference = normalizeCustomerReference({
    customerId: input.customerId,
    email: input.email,
    phone: input.phone,
  })

  let redeemedPoints = 0
  let loyaltyEarnedPoints = 0
  if (customerReference) {
    const loyalty =
      getState().loyaltyAccounts.find(
        entry => entry.customerId === customerReference
      ) ?? null
    const availablePoints = loyalty?.points ?? 0
    const requestedRedeemPoints =
      Number.isFinite(input.redeemPoints) && (input.redeemPoints ?? 0) > 0
        ? Math.floor(input.redeemPoints as number)
        : 0
    if (requestedRedeemPoints > 0) {
      redeemedPoints = Math.min(availablePoints, requestedRedeemPoints)
      const redeemValue = Number((redeemedPoints * 0.05).toFixed(2))
      amount = Number(Math.max(amount - redeemValue, 0).toFixed(2))
    }
    loyaltyEarnedPoints = Math.max(0, Math.floor(amount))
  }

  const tipPercent =
    Number.isFinite(input.tipPercent) && (input.tipPercent ?? 0) >= 0
      ? Math.min(Number(input.tipPercent), 40)
      : 0

  let tipAmount = Number((amount * (tipPercent / 100)).toFixed(2))
  let totalCharged = Number((amount + tipAmount).toFixed(2))

  if (totalCharged <= 0) {
    amount = 0.01
    tipAmount = Number((amount * (tipPercent / 100)).toFixed(2))
    totalCharged = Number((amount + tipAmount).toFixed(2))
  }

  return {
    tableId: table.id,
    tableNumber: table.number,
    amount,
    tipAmount,
    totalCharged,
    method: input.method,
    email: normalizeEmail(input.email),
    promoCode,
    promoDiscount,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    phone: input.phone ?? null,
    marketingOptIn: input.marketingOptIn === true,
    redeemedPoints,
    loyaltyEarnedPoints,
    idempotencyKey: input.idempotencyKey,
  }
}

export function processPreparedCustomerCheckout(
  input: PreparedCustomerCheckoutInput
) {
  const replay = readExistingCheckoutReplay(input.idempotencyKey)
  if (replay) {
    return replay.response
  }

  const table =
    findTableById(input.tableId) ??
    findTableByNumber(Math.floor(input.tableNumber))
  if (!table) {
    throw new Error("Unknown table number")
  }

  const billAfterPayment = addTablePayment({
    tableId: table.id,
    amount: Number(input.totalCharged.toFixed(2)),
    method: input.method,
    note:
      input.tipAmount > 0
        ? "Customer checkout tip"
        : "Customer checkout",
  })

  if (input.promoCode) {
    const promo =
      getState().promos.find(
        entry => entry.code === input.promoCode?.trim().toUpperCase()
      ) ?? null
    if (promo) {
      promo.usedCount += 1
    }
  }

  const profile = getOrCreateCustomerProfile({
    customerId: input.customerId,
    email: input.email,
    phone: input.phone,
    name: input.customerName,
    marketingOptIn: input.marketingOptIn,
  })

  if (profile) {
    const loyalty = getOrCreateLoyaltyAccount(profile.id)
    if ((input.redeemedPoints ?? 0) > 0) {
      loyalty.points = Math.max(
        0,
        loyalty.points - Math.max(0, Math.floor(input.redeemedPoints ?? 0))
      )
    }
    if ((input.loyaltyEarnedPoints ?? 0) > 0) {
      loyalty.points += Math.max(
        0,
        Math.floor(input.loyaltyEarnedPoints ?? 0)
      )
      loyalty.lifetimeSpend = Number(
        (loyalty.lifetimeSpend + Number(input.amount.toFixed(2))).toFixed(2)
      )
    }
    touchLoyaltyAccount(loyalty)
  }

  const receipt: RuntimeCheckoutReceipt = {
    receiptId: crypto.randomUUID(),
    tableId: table.id,
    tableNumber: table.number,
    amount: Number(input.amount.toFixed(2)),
    tipAmount: Number(input.tipAmount.toFixed(2)),
    totalCharged: Number(input.totalCharged.toFixed(2)),
    method: input.method,
    email: normalizeEmail(input.email),
    promoCode: input.promoCode?.trim().toUpperCase() ?? null,
    loyaltyRedeemedPoints: Math.max(
      0,
      Math.floor(input.redeemedPoints ?? 0)
    ),
    loyaltyEarnedPoints: Math.max(
      0,
      Math.floor(input.loyaltyEarnedPoints ?? 0)
    ),
    createdAt: nowIso(),
  }
  getState().checkoutReceipts.unshift(receipt)
  if (getState().checkoutReceipts.length > 1000) {
    getState().checkoutReceipts = getState().checkoutReceipts.slice(0, 1000)
  }

  if (receipt.email) {
    queueCustomerNotification({
      channel: "EMAIL",
      recipient: receipt.email,
      message: `Receipt ${receipt.receiptId.slice(0, 8)} for £${receipt.totalCharged.toFixed(2)}`,
      relatedType: "CHECKOUT_RECEIPT",
      relatedId: receipt.receiptId,
    })
  }

  const response = {
    quote: getCustomerCheckoutQuoteByTableNumber(table.number),
    bill: billAfterPayment,
    receipt,
    promoDiscount: Number((input.promoDiscount ?? 0).toFixed(2)),
    idempotencyReplay: false,
  }

  const scopedIdempotencyKey = input.idempotencyKey
    ? `checkout:${input.idempotencyKey}`
    : null
  storeCheckoutReplay(scopedIdempotencyKey, response)

  return response
}

export function processCustomerCheckout(input: {
  tableNumber: number
  shareCount?: number
  amount?: number
  tipPercent?: number
  method: WalletMethod
  email?: string | null
  promoCode?: string | null
  customerId?: string | null
  customerName?: string | null
  phone?: string | null
  marketingOptIn?: boolean
  redeemPoints?: number
  idempotencyKey?: string
}) {
  const replay = readExistingCheckoutReplay(input.idempotencyKey)
  if (replay) {
    return replay.response
  }
  const prepared = previewCustomerCheckout(input)
  return processPreparedCustomerCheckout(prepared)
}
export function listCheckoutReceipts(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100
  return getState().checkoutReceipts.slice(0, safeLimit)
}

export function upsertCustomerAccount(input: {
  customerId?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  marketingOptIn?: boolean
}) {
  const profile = getOrCreateCustomerProfile(input)
  if (!profile) {
    throw new Error("customerId, email, or phone is required")
  }
  return profile
}

export function listCustomerAccounts(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().customerProfiles
    .slice()
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, safeLimit)
}

export function getCustomerAccount(customerId: string) {
  return (
    getState().customerProfiles.find(entry => entry.id === customerId) ?? null
  )
}

export function getLoyaltyAccount(customerId: string) {
  return (
    getState().loyaltyAccounts.find(entry => entry.customerId === customerId) ??
    null
  )
}

export function listLoyaltyAccounts(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().loyaltyAccounts
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, safeLimit)
}

export function listPromoCodes() {
  return getState().promos
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
}

export function upsertPromoCode(input: {
  code: string
  description: string
  kind: PromoCodeKind
  value: number
  minSpend?: number
  active?: boolean
  startsAt?: string | null
  endsAt?: string | null
  maxUses?: number | null
}) {
  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    throw new Error("Promo code must be 3-24 chars (A-Z, 0-9, _, -)")
  }
  if (!input.description || input.description.trim() === "") {
    throw new Error("Promo description is required")
  }
  if (input.kind !== "PERCENT" && input.kind !== "FIXED") {
    throw new Error("Promo kind must be PERCENT or FIXED")
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error("Promo value must be greater than zero")
  }

  const minSpend =
    Number.isFinite(input.minSpend) && (input.minSpend ?? 0) > 0
      ? Number((input.minSpend as number).toFixed(2))
      : 0
  const maxUses =
    input.maxUses === null
      ? null
      : Number.isFinite(input.maxUses) && (input.maxUses as number) > 0
      ? Math.floor(input.maxUses as number)
      : null

  const state = getState()
  const existing = state.promos.find(entry => entry.code === code)

  if (existing) {
    existing.description = input.description.trim()
    existing.kind = input.kind
    existing.value = Number(input.value.toFixed(2))
    existing.minSpend = minSpend
    existing.active = input.active ?? existing.active
    existing.startsAt = input.startsAt ?? existing.startsAt
    existing.endsAt = input.endsAt ?? existing.endsAt
    existing.maxUses = maxUses
    return existing
  }

  const created: RuntimePromoCode = {
    code,
    description: input.description.trim(),
    kind: input.kind,
    value: Number(input.value.toFixed(2)),
    minSpend,
    active: input.active ?? true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    maxUses,
    usedCount: 0,
  }
  state.promos.push(created)
  return created
}

export function setPromoCodeActive(code: string, active: boolean) {
  const promo = getState().promos.find(
    entry => entry.code === code.trim().toUpperCase()
  )
  if (!promo) {
    throw new Error("Promo code not found")
  }
  promo.active = active
  return promo
}

export function createReservation(input: {
  name: string
  phone: string
  partySize: number
  requestedFor: string
  note?: string
}) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name) throw new Error("name is required")
  if (!phone) throw new Error("phone is required")
  if (!Number.isFinite(input.partySize) || input.partySize < 1) {
    throw new Error("partySize must be >= 1")
  }
  if (!input.requestedFor || Number.isNaN(new Date(input.requestedFor).getTime())) {
    throw new Error("requestedFor must be a valid ISO date-time")
  }

  const reservation: RuntimeReservation = {
    id: crypto.randomUUID(),
    name,
    phone,
    partySize: Math.floor(input.partySize),
    requestedFor: new Date(input.requestedFor).toISOString(),
    note: input.note?.trim() || undefined,
    status: "REQUESTED",
    createdAt: nowIso(),
  }
  getState().reservations.unshift(reservation)
  return reservation
}

export function listReservations(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().reservations
    .slice()
    .sort((a, b) => b.requestedFor.localeCompare(a.requestedFor))
    .slice(0, safeLimit)
}

export function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
) {
  const reservation =
    getState().reservations.find(entry => entry.id === reservationId) ?? null
  if (!reservation) {
    throw new Error("Reservation not found")
  }
  reservation.status = status

  if (status === "CONFIRMED" || status === "SEATED") {
    queueCustomerNotification({
      channel: "SMS",
      recipient: reservation.phone,
      message:
        status === "CONFIRMED"
          ? `Reservation confirmed for ${reservation.partySize} guest(s).`
          : "Your table is now ready.",
      relatedType: "RESERVATION",
      relatedId: reservation.id,
    })
  }

  return reservation
}

export function addWaitlistEntry(input: {
  name: string
  phone: string
  partySize: number
}) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name) throw new Error("name is required")
  if (!phone) throw new Error("phone is required")
  if (!Number.isFinite(input.partySize) || input.partySize < 1) {
    throw new Error("partySize must be >= 1")
  }

  const entry: RuntimeWaitlistEntry = {
    id: crypto.randomUUID(),
    name,
    phone,
    partySize: Math.floor(input.partySize),
    createdAt: nowIso(),
    notifiedAt: null,
    status: "WAITING",
  }
  getState().waitlist.unshift(entry)
  return entry
}

export function listWaitlist(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().waitlist
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit)
}

export function updateWaitlistStatus(
  waitlistId: string,
  status: WaitlistStatus
) {
  const entry = getState().waitlist.find(item => item.id === waitlistId) ?? null
  if (!entry) {
    throw new Error("Waitlist entry not found")
  }
  entry.status = status
  if (status === "NOTIFIED") {
    entry.notifiedAt = nowIso()
    queueCustomerNotification({
      channel: "SMS",
      recipient: entry.phone,
      message: "Your table is now available. Please check in with staff.",
      relatedType: "WAITLIST",
      relatedId: entry.id,
    })
  }
  return entry
}

export function queueCustomerNotification(input: {
  channel: CustomerNotificationDTO["channel"]
  recipient: string
  message: string
  relatedType: string
  relatedId: string
}) {
  const notification: RuntimeNotification = {
    id: crypto.randomUUID(),
    channel: input.channel,
    recipient: input.recipient.trim(),
    message: input.message.trim(),
    relatedType: input.relatedType,
    relatedId: input.relatedId,
    createdAt: nowIso(),
  }
  getState().notifications.unshift(notification)
  if (getState().notifications.length > 2000) {
    getState().notifications = getState().notifications.slice(0, 2000)
  }
  return notification
}

export function listCustomerNotifications(options?: {
  limit?: number
  recipient?: string
}) {
  const safeLimit = Number.isFinite(options?.limit)
    ? Math.max(1, Math.min(options?.limit as number, 1000))
    : 200
  const recipient = options?.recipient?.trim()
  return getState().notifications
    .filter(entry => {
      if (!recipient) return true
      return entry.recipient === recipient
    })
    .slice(0, safeLimit)
}

export function createFeedback(input: {
  tableNumber?: number | null
  orderId?: string | null
  customerId?: string | null
  rating: number
  comment: string
}) {
  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("rating must be between 1 and 5")
  }
  const comment = input.comment.trim()
  if (!comment) {
    throw new Error("comment is required")
  }

  const feedback: RuntimeFeedback = {
    id: crypto.randomUUID(),
    tableNumber:
      typeof input.tableNumber === "number" && Number.isFinite(input.tableNumber)
        ? Math.floor(input.tableNumber)
        : null,
    orderId: input.orderId?.trim() || null,
    customerId: input.customerId?.trim() || null,
    rating: Math.round(input.rating),
    comment,
    createdAt: nowIso(),
  }
  getState().feedback.unshift(feedback)
  if (getState().feedback.length > 3000) {
    getState().feedback = getState().feedback.slice(0, 3000)
  }
  return feedback
}

export function listFeedback(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().feedback.slice(0, safeLimit)
}

export function createDeliveryChannelOrder(input: {
  channel: DeliveryChannel
  externalRef: string
  total: number
}) {
  if (
    input.channel !== "UBER_EATS" &&
    input.channel !== "DELIVEROO" &&
    input.channel !== "JUST_EAT" &&
    input.channel !== "DIRECT"
  ) {
    throw new Error("channel must be UBER_EATS, DELIVEROO, JUST_EAT, or DIRECT")
  }
  if (!input.externalRef || input.externalRef.trim() === "") {
    throw new Error("externalRef is required")
  }
  if (!Number.isFinite(input.total) || input.total < 0) {
    throw new Error("total must be non-negative")
  }

  const order: RuntimeDeliveryOrder = {
    id: crypto.randomUUID(),
    channel: input.channel,
    externalRef: input.externalRef.trim(),
    status: "NEW",
    total: Number(input.total.toFixed(2)),
    createdAt: nowIso(),
  }
  getState().deliveryOrders.unshift(order)
  return order
}

export function listDeliveryChannelOrders(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200
  return getState().deliveryOrders.slice(0, safeLimit)
}

export function updateDeliveryOrderStatus(
  orderId: string,
  status: DeliveryOrderStatus
) {
  const order =
    getState().deliveryOrders.find(entry => entry.id === orderId) ?? null
  if (!order) {
    throw new Error("Delivery order not found")
  }
  order.status = status
  return order
}

export function listMenuDayparts() {
  return getState().menuDayparts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function upsertMenuDaypart(input: {
  id?: string
  name: string
  enabled?: boolean
  days: number[]
  startTime: string
  endTime: string
  sectionIds?: string[]
  itemIds?: string[]
}) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("name is required")
  }
  if (!Array.isArray(input.days) || input.days.length === 0) {
    throw new Error("days must contain at least one day number")
  }
  const normalizedDays = Array.from(
    new Set(
      input.days
        .filter(day => Number.isFinite(day))
        .map(day => Math.floor(day))
        .filter(day => day >= 0 && day <= 6)
    )
  )
  if (normalizedDays.length === 0) {
    throw new Error("days must contain values from 0 to 6")
  }
  validateTimeString(input.startTime, "startTime")
  validateTimeString(input.endTime, "endTime")

  const id = input.id?.trim() || crypto.randomUUID()
  const state = getState()
  const existing = state.menuDayparts.find(entry => entry.id === id)

  if (existing) {
    existing.name = name
    existing.enabled = input.enabled ?? existing.enabled
    existing.days = normalizedDays
    existing.startTime = input.startTime
    existing.endTime = input.endTime
    existing.sectionIds = Array.from(new Set(input.sectionIds ?? []))
    existing.itemIds = Array.from(new Set(input.itemIds ?? []))
    return existing
  }

  const created: RuntimeMenuDaypart = {
    id,
    name,
    enabled: input.enabled ?? true,
    days: normalizedDays,
    startTime: input.startTime,
    endTime: input.endTime,
    sectionIds: Array.from(new Set(input.sectionIds ?? [])),
    itemIds: Array.from(new Set(input.itemIds ?? [])),
  }
  state.menuDayparts.push(created)
  return created
}

export function removeMenuDaypart(id: string) {
  const state = getState()
  const before = state.menuDayparts.length
  state.menuDayparts = state.menuDayparts.filter(entry => entry.id !== id)
  return { removed: before !== state.menuDayparts.length }
}

export function getInventoryLowStockThreshold() {
  const state = getState()
  const flags = state.history["system:flags"]?.data
  if (isPlainObject(flags) && Number.isFinite(flags.lowStockThreshold)) {
    return Math.max(0, Math.floor(flags.lowStockThreshold as number))
  }
  return 5
}

export function setInventoryLowStockThreshold(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("lowStockThreshold must be >= 0")
  }
  const state = getState()
  const flags = isPlainObject(state.history["system:flags"]?.data)
    ? state.history["system:flags"].data
    : {}
  state.history["system:flags"] = {
    id: "system:flags",
    data: {
      ...flags,
      lowStockThreshold: Math.floor(value),
    },
    updatedAt: nowIso(),
  }
  return getInventoryLowStockThreshold()
}

export function listInventoryAlerts() {
  const threshold = getInventoryLowStockThreshold()
  return getMenuSnapshot({ includeInactive: true }).menu.flatMap(section =>
    section.items
      .filter(
        item =>
          typeof item.stockCount === "number" &&
          item.stockCount <= threshold
      )
      .map(item => ({
        sectionId: section.id,
        sectionName: section.name,
        itemId: item.id,
        itemName: item.name,
        stockCount: item.stockCount as number,
        threshold,
      }))
  )
}

export function getFeatureSummary(): FeatureSummaryDTO {
  const state = getState()
  return {
    reservations: state.reservations.length,
    waitlist: state.waitlist.length,
    promos: state.promos.length,
    feedback: state.feedback.length,
    notifications: state.notifications.length,
    loyaltyMembers: state.loyaltyAccounts.length,
    deliveryOrders: state.deliveryOrders.length,
  }
}

export function listTags(): TagDTO[] {
  const state = getState()
  return state.tags
    .slice()
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .map(tag => {
      const table = tag.tableId ? findTableById(tag.tableId) : null
      const activeSessionCount = state.sessions.filter(
        s => s.tagId === tag.id && !asStale(s.lastActivityAt)
      ).length

      return {
        id: tag.id,
        active: tag.active,
        tableNumber: table?.number ?? null,
        activeSessionCount,
        lastSeenAt: tag.lastSeenAt,
      }
    })
}

export function registerTagScan(tagId: string) {
  const state = getState()
  const now = nowIso()
  const existing = findTagById(tagId)
  if (existing) {
    existing.lastSeenAt = now
    existing.active = true
    return existing
  }

  const created: RuntimeTag = {
    id: tagId,
    active: true,
    tableId: null,
    lastSeenAt: now,
    createdAt: now,
  }
  state.tags.push(created)
  return created
}

export function assignTag(tagId: string, tableId: string | null) {
  const tag = registerTagScan(tagId)
  if (tableId) {
    const table = findTableById(tableId)
    if (!table) {
      throw new Error("Unknown table")
    }
  }
  tag.tableId = tableId
  tag.lastSeenAt = nowIso()
  return tag
}

export function listSessions(): SessionDTO[] {
  return getState().sessions
    .slice()
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .map(s => ({
      id: s.id,
      origin: s.origin,
      tagId: s.tagId,
      tableId: s.tableId,
      lastActivityAt: s.lastActivityAt,
      stale: asStale(s.lastActivityAt),
    }))
}

export function createOrResumeSession(input: {
  sessionId?: string
  origin: SessionOrigin
  tagId?: string
}) {
  const state = getState()

  if (input.sessionId) {
    const existing = state.sessions.find(s => s.id === input.sessionId)
    if (existing) {
      touchSession(existing, input.tagId)
      return existing
    }
  }

  const now = nowIso()
  const tableId =
    input.tagId && !isTakeawayTag(input.tagId)
      ? registerTagScan(input.tagId).tableId
      : null
  const session: RuntimeSession = {
    id: crypto.randomUUID(),
    origin: input.origin,
    tagId:
      input.tagId && !isTakeawayTag(input.tagId)
        ? input.tagId
        : null,
    tableId,
    lastActivityAt: now,
    createdAt: now,
  }
  state.sessions.push(session)
  return session
}

export function getSessionById(sessionId: string) {
  return getState().sessions.find(s => s.id === sessionId) ?? null
}

export function submitOrder(input: {
  sessionId: string
  tagId: string
  items: OrderSubmissionItemDTO[]
  idempotencyKey?: string
}) {
  const state = getState()
  const scopedIdempotencyKey = input.idempotencyKey
    ? `order:${input.idempotencyKey}`
    : null
  if (scopedIdempotencyKey) {
    const existing = state.idempotencyRecords[scopedIdempotencyKey]
    if (existing) {
      return existing.response
    }
  }

  if (getSystemFlags().serviceLocked) {
    throw new Error("Service is temporarily locked")
  }

  if (input.items.length === 0) {
    throw new Error("Order must include at least one item")
  }

  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Item quantities must be greater than zero")
    }
  }

  const session = getSessionById(input.sessionId)
  if (!session) {
    throw new Error("Unknown session")
  }

  let tableId = "takeaway"
  let tableNumber = 0

  if (!isTakeawayTag(input.tagId)) {
    const tag = registerTagScan(input.tagId)
    if (!tag.tableId) {
      throw new Error("Tag is not assigned to a table")
    }

    const table = findTableById(tag.tableId)
    if (!table) {
      throw new Error("Table not found")
    }
    const tableView = toTableDTO(table)
    if (tableView.locked || tableView.stale || tableView.closed) {
      throw new Error("Table is not accepting new orders")
    }
    tableId = table.id
    tableNumber = table.number
  }

  const stockAdjustments = new Map<string, number>()
  for (const raw of input.items) {
    const menuItem = findMenuItem(raw.itemId)
    if (!menuItem) continue
    if (typeof menuItem.stockCount !== "number") continue

    const pending = stockAdjustments.get(raw.itemId) ?? 0
    const remaining = menuItem.stockCount - pending
    if (remaining < raw.quantity) {
      throw new Error(`Out of stock: ${menuItem.name}`)
    }
    stockAdjustments.set(raw.itemId, pending + raw.quantity)
  }

  const normalizedItems: RuntimeOrderItem[] = input.items.map(raw => {
    const menuItem = findMenuItem(raw.itemId)
    if (menuItem && menuItem.active === false) {
      throw new Error(`Item unavailable: ${menuItem.name}`)
    }
    const basePrice = menuItem?.basePrice ?? raw.unitPrice ?? 0
    const edits = raw.edits ?? null
    const unitPrice = calculateItemPrice(basePrice, edits)

    return {
      lineId: crypto.randomUUID(),
      itemId: raw.itemId,
      name: menuItem?.name ?? raw.name,
      quantity: raw.quantity,
      edits,
      allergens: menuItem?.allergens ?? raw.allergens ?? [],
      unitPrice,
      vatRate: menuItem?.vatRate ?? raw.vatRate ?? 0,
      station: menuItem?.station ?? raw.station,
      kitchenStartedAt: null,
      kitchenSentAt: null,
      barStartedAt: null,
      barSentAt: null,
      deliveredAt: null,
      voidedAt: null,
      voidReason: null,
      compedAt: null,
      compReason: null,
      refireOfLineId: null,
    }
  })

  for (const [itemId, quantity] of stockAdjustments.entries()) {
    const menuItem = findMenuItem(itemId)
    if (!menuItem || typeof menuItem.stockCount !== "number") continue
    const nextStock = Math.max(0, menuItem.stockCount - quantity)
    updateMenuItem({
      itemId,
      patch: {
        stockCount: nextStock,
      },
    })
  }

  const now = nowIso()
  const order: RuntimeOrder = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    tagId: input.tagId,
    tableId,
    tableNumber,
    submittedAt: now,
    checkoutSessionId: null,
    paymentIntentId: null,
    checkoutStatus: "PENDING",
    items: normalizedItems,
  }

  state.orders.push(order)
  touchSession(session, isTakeawayTag(input.tagId) ? undefined : input.tagId)
  queueCustomerNotification({
    channel: "IN_APP",
    recipient: `session:${session.id}`,
    message: `Order accepted for ${order.tableNumber === 0 ? "takeaway" : `table ${order.tableNumber}`}.`,
    relatedType: "ORDER",
    relatedId: order.id,
  })

  const totals = calculateCartTotals(
    normalizedItems.map(i => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
    }))
  )

  const response = {
    id: order.id,
    tableNumber: order.tableNumber,
    submittedAt: order.submittedAt,
    totals,
  }
  if (scopedIdempotencyKey) {
    state.idempotencyRecords[scopedIdempotencyKey] = {
      key: scopedIdempotencyKey,
      createdAt: nowIso(),
      response,
    }
  }
  return response
}

function toMinorUnits(amount: number) {
  if (!Number.isFinite(amount)) return 0
  return Math.max(1, Math.round(amount * 100))
}

export function getOrderForCheckoutSession(orderId: string) {
  const normalizedOrderId = orderId.trim()
  if (!normalizedOrderId) {
    throw new Error("orderId is required")
  }

  const order =
    getState().orders.find(entry => entry.id === normalizedOrderId) ??
    null
  if (!order) {
    throw new Error("Order not found")
  }

  const lineItems = order.items
    .filter(item => !item.voidedAt && !item.compedAt)
    .map(item => ({
      name: item.name,
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitAmountMinor: toMinorUnits(item.unitPrice),
    }))

  if (lineItems.length === 0) {
    throw new Error("Order has no chargeable line items")
  }

  const totalAmountMinor = lineItems.reduce(
    (sum, line) => sum + line.unitAmountMinor * line.quantity,
    0
  )

  return {
    orderId: order.id,
    sessionId: order.sessionId,
    tableNumber: order.tableNumber,
    currency: "gbp",
    lineItems,
    totalAmountMinor,
    checkoutSessionId: order.checkoutSessionId,
    paymentIntentId: order.paymentIntentId,
    checkoutStatus: order.checkoutStatus,
  }
}

export function updateOrderStripePaymentState(input: {
  orderId: string
  checkoutSessionId?: string | null
  paymentIntentId?: string | null
  checkoutStatus?: string | null
}) {
  const order =
    getState().orders.find(entry => entry.id === input.orderId.trim()) ??
    null
  if (!order) {
    throw new Error("Order not found")
  }

  if (input.checkoutSessionId !== undefined) {
    order.checkoutSessionId = input.checkoutSessionId
      ? input.checkoutSessionId.trim()
      : null
  }

  if (input.paymentIntentId !== undefined) {
    order.paymentIntentId = input.paymentIntentId
      ? input.paymentIntentId.trim()
      : null
  }

  if (input.checkoutStatus !== undefined) {
    order.checkoutStatus = input.checkoutStatus
      ? input.checkoutStatus.trim().toUpperCase()
      : null
  }

  return {
    orderId: order.id,
    checkoutSessionId: order.checkoutSessionId,
    paymentIntentId: order.paymentIntentId,
    checkoutStatus: order.checkoutStatus,
  }
}

export function getStationQueue(station: Station): OrderQueueItemDTO[] {
  const queue: OrderQueueItemDTO[] = []
  const state = getState()

  for (const order of state.orders) {
    for (const item of order.items) {
      const readyAt =
        station === "KITCHEN" ? item.kitchenSentAt : item.barSentAt
      const startedAt =
        station === "KITCHEN"
          ? item.kitchenStartedAt
          : item.barStartedAt
      if (
        item.station !== station ||
        readyAt ||
        item.deliveredAt ||
        item.voidedAt
      ) {
        continue
      }
      queue.push({
        orderId: order.id,
        lineId: item.lineId,
        tableNumber: order.tableNumber,
        name: item.name,
        quantity: item.quantity,
        station: item.station,
        edits: item.edits ?? null,
        submittedAt: order.submittedAt,
        startedAt,
        prepState: startedAt ? "PREPPING" : "SUBMITTED",
        voidedAt: item.voidedAt,
        compedAt: item.compedAt,
        refireOfLineId: item.refireOfLineId,
      })
    }
  }

  return queue.sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() -
      new Date(b.submittedAt).getTime()
  )
}

export function getReadyQueue(): ReadyQueueItemDTO[] {
  const queue: ReadyQueueItemDTO[] = []
  const state = getState()

  for (const order of state.orders) {
    for (const item of order.items) {
      const ready =
        (item.station === "KITCHEN" && !!item.kitchenSentAt) ||
        (item.station === "BAR" && !!item.barSentAt)

      if (!ready || item.deliveredAt) {
        continue
      }
      if (item.voidedAt) {
        continue
      }

      queue.push({
        orderId: order.id,
        lineId: item.lineId,
        tableNumber: order.tableNumber,
        name: item.name,
        quantity: item.quantity,
        station: item.station,
        edits: item.edits ?? null,
        submittedAt: order.submittedAt,
        readyAt:
          item.station === "KITCHEN"
            ? item.kitchenSentAt
            : item.barSentAt,
        compedAt: item.compedAt,
      })
    }
  }

  return queue.sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() -
      new Date(b.submittedAt).getTime()
  )
}

export function getSessionOrderProgress(
  sessionId: string
): SessionOrderProgressDTO[] {
  const orders = getState().orders
    .filter(order => order.sessionId === sessionId)
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
    )

  return orders.map(order => {
    const lines = order.items.map(item => ({
      lineId: item.lineId,
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      station: item.station,
      state: getItemPrepState(item),
      voidedAt: item.voidedAt,
      compedAt: item.compedAt,
      refireOfLineId: item.refireOfLineId,
    }))

    const states = lines.reduce(
      (acc, line) => {
        if (line.voidedAt) return acc
        if (line.state === "SUBMITTED") acc.submitted += line.quantity
        if (line.state === "PREPPING") acc.prepping += line.quantity
        if (line.state === "READY") acc.ready += line.quantity
        if (line.state === "DELIVERED") acc.delivered += line.quantity
        return acc
      },
      {
        submitted: 0,
        prepping: 0,
        ready: 0,
        delivered: 0,
      }
    )

    return {
      orderId: order.id,
      tagId: order.tagId,
      tableNumber: order.tableNumber,
      submittedAt: order.submittedAt,
      totalItems: lines.reduce(
        (sum, line) =>
          line.voidedAt ? sum : sum + line.quantity,
        0
      ),
      states,
      lines,
    }
  })
}

export function markStationSent(input: {
  tableNumber: number
  station: Station
  lineIds?: string[]
}) {
  const state = getState()
  const now = nowIso()
  const lineIdSet =
    input.lineIds && input.lineIds.length > 0
      ? new Set(input.lineIds)
      : null
  let updated = 0
  const touchedSessions = new Set<string>()

  for (const order of state.orders) {
    if (order.tableNumber !== input.tableNumber) continue
    for (const item of order.items) {
      if (item.station !== input.station) continue
      if (item.deliveredAt || item.voidedAt) continue
      if (lineIdSet && !lineIdSet.has(item.lineId)) continue
      if (input.station === "KITCHEN" && !item.kitchenSentAt) {
        if (!item.kitchenStartedAt) item.kitchenStartedAt = now
        item.kitchenSentAt = now
        updated += 1
        touchedSessions.add(order.sessionId)
      }
      if (input.station === "BAR" && !item.barSentAt) {
        if (!item.barStartedAt) item.barStartedAt = now
        item.barSentAt = now
        updated += 1
        touchedSessions.add(order.sessionId)
      }
    }
  }

  if (updated > 0) {
    for (const sessionId of touchedSessions) {
      queueCustomerNotification({
        channel: "IN_APP",
        recipient: `session:${sessionId}`,
        message: `${input.station === "KITCHEN" ? "Kitchen" : "Bar"} has marked items ready.`,
        relatedType: "ORDER_STATUS",
        relatedId: `${input.tableNumber}:${input.station}:ready`,
      })
    }
  }

  return { updated }
}

export function markStationPreparing(input: {
  tableNumber: number
  station: Station
  lineIds?: string[]
}) {
  const state = getState()
  const now = nowIso()
  const lineIdSet =
    input.lineIds && input.lineIds.length > 0
      ? new Set(input.lineIds)
      : null
  let updated = 0
  const touchedSessions = new Set<string>()

  for (const order of state.orders) {
    if (order.tableNumber !== input.tableNumber) continue
    for (const item of order.items) {
      if (item.station !== input.station) continue
      if (item.deliveredAt || item.voidedAt) continue
      if (lineIdSet && !lineIdSet.has(item.lineId)) continue
      if (input.station === "KITCHEN" && !item.kitchenSentAt && !item.kitchenStartedAt) {
        item.kitchenStartedAt = now
        updated += 1
        touchedSessions.add(order.sessionId)
      }
      if (input.station === "BAR" && !item.barSentAt && !item.barStartedAt) {
        item.barStartedAt = now
        updated += 1
        touchedSessions.add(order.sessionId)
      }
    }
  }

  if (updated > 0) {
    for (const sessionId of touchedSessions) {
      queueCustomerNotification({
        channel: "IN_APP",
        recipient: `session:${sessionId}`,
        message: `${input.station === "KITCHEN" ? "Kitchen" : "Bar"} has started preparing your items.`,
        relatedType: "ORDER_STATUS",
        relatedId: `${input.tableNumber}:${input.station}:prepping`,
      })
    }
  }

  return { updated }
}

export function markTableDelivered(
  tableNumber: number,
  lineIds?: string[]
) {
  const state = getState()
  const now = nowIso()
  const lineIdSet =
    lineIds && lineIds.length > 0 ? new Set(lineIds) : null
  let updated = 0
  const touchedSessions = new Set<string>()

  for (const order of state.orders) {
    if (order.tableNumber !== tableNumber) continue

    for (const item of order.items) {
      if (lineIdSet && !lineIdSet.has(item.lineId)) continue
      if (item.voidedAt) continue
      const ready =
        (item.station === "KITCHEN" && !!item.kitchenSentAt) ||
        (item.station === "BAR" && !!item.barSentAt)
      if (!ready || item.deliveredAt) continue

      item.deliveredAt = now
      updated += 1
      touchedSessions.add(order.sessionId)
    }
  }

  if (updated > 0) {
    for (const sessionId of touchedSessions) {
      queueCustomerNotification({
        channel: "IN_APP",
        recipient: `session:${sessionId}`,
        message: "Order delivered. Enjoy!",
        relatedType: "ORDER_STATUS",
        relatedId: `${tableNumber}:delivered`,
      })
    }
  }

  return { updated }
}

export function voidOrderLine(input: {
  lineId: string
  reason: string
}) {
  const found = findOrderLine(input.lineId)
  if (!found) {
    throw new Error("Order line not found")
  }
  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Void reason is required")
  }
  if (found.line.voidedAt) {
    throw new Error("Order line already voided")
  }

  found.line.voidedAt = nowIso()
  found.line.voidReason = reason
  return {
    orderId: found.order.id,
    lineId: found.line.lineId,
    tableNumber: found.order.tableNumber,
    reason,
  }
}

export function compOrderLine(input: {
  lineId: string
  reason: string
}) {
  const found = findOrderLine(input.lineId)
  if (!found) {
    throw new Error("Order line not found")
  }
  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Comp reason is required")
  }
  if (found.line.compedAt) {
    throw new Error("Order line already comped")
  }

  found.line.compedAt = nowIso()
  found.line.compReason = reason
  return {
    orderId: found.order.id,
    lineId: found.line.lineId,
    tableNumber: found.order.tableNumber,
    reason,
  }
}

export function refireOrderLine(input: {
  lineId: string
  reason: string
}) {
  const found = findOrderLine(input.lineId)
  if (!found) {
    throw new Error("Order line not found")
  }

  const reason = input.reason.trim()
  if (!reason) {
    throw new Error("Refire reason is required")
  }

  const clone: RuntimeOrderItem = {
    ...found.line,
    lineId: crypto.randomUUID(),
    kitchenStartedAt: null,
    kitchenSentAt: null,
    barStartedAt: null,
    barSentAt: null,
    deliveredAt: null,
    voidedAt: null,
    voidReason: null,
    compedAt: null,
    compReason: null,
    refireOfLineId: found.line.lineId,
  }

  found.order.items.push(clone)
  return {
    orderId: found.order.id,
    tableNumber: found.order.tableNumber,
    sourceLineId: found.line.lineId,
    refiredLineId: clone.lineId,
    reason,
  }
}

function queuePrintJob(input: {
  tableNumber: number
  station: Station
  reason: string
  note?: string
}) {
  const job: RuntimePrintJob = {
    id: crypto.randomUUID(),
    tableNumber: input.tableNumber,
    station: input.station,
    status: "QUEUED",
    attempts: 1,
    reason: input.reason,
    note: input.note ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  getState().printJobs.unshift(job)
  return job
}

export function listPrintJobs(options?: {
  station?: Station
  status?: PrintJobStatus
}): PrintJobDTO[] {
  return getState().printJobs
    .filter(job => {
      if (options?.station && job.station !== options.station) return false
      if (options?.status && job.status !== options.status) return false
      return true
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(job => ({ ...job }))
}

export function retryPrintJob(jobId: string) {
  const job = getState().printJobs.find(x => x.id === jobId)
  if (!job) {
    throw new Error("Print job not found")
  }
  job.attempts += 1
  job.status = "QUEUED"
  job.updatedAt = nowIso()
  return { ...job }
}

export function updatePrintJobStatus(input: {
  jobId: string
  status: PrintJobStatus
  note?: string
}) {
  const job = getState().printJobs.find(x => x.id === input.jobId)
  if (!job) {
    throw new Error("Print job not found")
  }
  job.status = input.status
  if (typeof input.note === "string") {
    job.note = input.note
  }
  job.updatedAt = nowIso()
  return { ...job }
}

export function reprintTable(tableNumber: number) {
  const state = getState()
  state.reprints.push({
    id: crypto.randomUUID(),
    tableNumber,
    createdAt: nowIso(),
  })

  const lines = state.orders
    .filter(order => order.tableNumber === tableNumber)
    .flatMap(order =>
      order.items.filter(item => !item.voidedAt)
    )

  const stations = new Set<Station>(
    lines.map(line => line.station)
  )

  const jobs: RuntimePrintJob[] = []
  for (const station of stations.values()) {
    jobs.push(
      queuePrintJob({
        tableNumber,
        station,
        reason: "MANUAL_REPRINT",
      })
    )
  }

  return jobs
}

export function getTableReview(tableNumber: number): TableReviewDTO {
  const orders = getState().orders
    .filter(o => o.tableNumber === tableNumber)
    .sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() -
        new Date(b.submittedAt).getTime()
    )

  const groups = orders.map(order => ({
    orderId: order.id,
    submittedAt: order.submittedAt,
    items: order.items.map(item => ({
      lineId: item.lineId,
      name: item.name,
      quantity: item.quantity,
      edits: item.edits ?? null,
      submittedAt: order.submittedAt,
      state: getItemPrepState(item),
      voidedAt: item.voidedAt,
      compedAt: item.compedAt,
      refireOfLineId: item.refireOfLineId,
    })),
  }))

  const firstSubmittedAt = groups[0]?.submittedAt ?? nowIso()
  const initialOrders = groups.length > 0 ? [groups[0]] : []
  const addonOrders = groups.slice(1)

  return {
    tableNumber,
    firstSubmittedAt,
    initialOrders,
    addonOrders,
  }
}

export function runTableAction(input: {
  action: "LOCK_TABLE" | "UNLOCK_TABLE" | "CLOSE_PAID" | "CLOSE_UNPAID"
  tableId: string
}) {
  const table = findTableById(input.tableId)
  if (!table) {
    throw new Error("Unknown table")
  }

  if (input.action === "LOCK_TABLE") {
    table.locked = true
  } else if (input.action === "UNLOCK_TABLE") {
    table.locked = false
  } else if (input.action === "CLOSE_PAID") {
    table.closeStatus = "PAID"
    table.billStatus = "PAID"
    table.locked = true
  } else if (input.action === "CLOSE_UNPAID") {
    table.closeStatus = "UNPAID"
    table.billStatus = "UNPAID"
    table.locked = true
  }

  return toTableDTO(table)
}

export function addStaffMessage(input: {
  tableId: string
  target: Station
  message: string
}) {
  if (!findTableById(input.tableId)) {
    throw new Error("Unknown table")
  }

  const record: RuntimeStaffMessage = {
    id: crypto.randomUUID(),
    tableId: input.tableId,
    target: input.target,
    message: input.message,
    createdAt: nowIso(),
  }
  getState().staffMessages.push(record)
  return record
}

export function getShiftReport(): ShiftReportDTO {
  const state = getState()
  const rawLines = state.orders.flatMap(order =>
    order.items.map(item => ({
      orderId: order.id,
      tableNumber: order.tableNumber,
      submittedAt: order.submittedAt,
      ...item,
    }))
  )
  const lines = rawLines.filter(line => !line.voidedAt)

  const subtotal = lines.reduce(
    (sum, line) => sum + lineEffectiveTotal(line),
    0
  )
  const vat = lines.reduce(
    (sum, line) =>
      line.compedAt
        ? sum
        : sum + calculateVat(line.unitPrice * line.quantity, line.vatRate),
    0
  )
  const kitchenLines = lines.filter(line => line.station === "KITCHEN").length
  const barLines = lines.filter(line => line.station === "BAR").length

  const prepDurations = lines
    .map(line => {
      if (line.voidedAt) return null
      const startedAt =
        line.station === "KITCHEN"
          ? line.kitchenStartedAt
          : line.barStartedAt
      const readyAt =
        line.station === "KITCHEN" ? line.kitchenSentAt : line.barSentAt
      if (!startedAt || !readyAt) return null
      return (
        (new Date(readyAt).getTime() - new Date(startedAt).getTime()) /
        60000
      )
    })
    .filter((value): value is number => typeof value === "number" && value >= 0)

  const readyToDeliveredDurations = lines
    .map(line => {
      if (line.voidedAt) return null
      const readyAt =
        line.station === "KITCHEN" ? line.kitchenSentAt : line.barSentAt
      if (!readyAt || !line.deliveredAt) return null
      return (
        (new Date(line.deliveredAt).getTime() -
          new Date(readyAt).getTime()) /
        60000
      )
    })
    .filter((value): value is number => typeof value === "number" && value >= 0)

  const delayedActiveLines = lines.filter(line => {
    if (line.voidedAt) return false
    const state = getItemPrepState(line)
    if (state === "READY" || state === "DELIVERED") return false
    const age =
      (Date.now() - new Date(line.submittedAt).getTime()) / 60000
    return age > 10
  }).length

  const avgPrepMinutes =
    prepDurations.length > 0
      ? prepDurations.reduce((sum, value) => sum + value, 0) /
        prepDurations.length
      : 0
  const avgReadyToDeliveredMinutes =
    readyToDeliveredDurations.length > 0
      ? readyToDeliveredDurations.reduce((sum, value) => sum + value, 0) /
        readyToDeliveredDurations.length
      : 0

  return {
    generatedAt: nowIso(),
    orders: state.orders.length,
    orderLines: lines.length,
    totalRevenue: Number(subtotal.toFixed(2)),
    totalVat: Number(vat.toFixed(2)),
    byStation: {
      kitchenLines,
      barLines,
    },
    performance: {
      avgPrepMinutes: Number(avgPrepMinutes.toFixed(2)),
      avgReadyToDeliveredMinutes: Number(
        avgReadyToDeliveredMinutes.toFixed(2)
      ),
      delayedActiveLines,
    },
  }
}

export function exportOrdersCsv() {
  const header = [
    "order_id",
    "line_id",
    "session_id",
    "tag_id",
    "table_number",
    "submitted_at",
    "item_id",
    "item_name",
    "quantity",
    "unit_price",
    "vat_rate",
    "station",
    "prep_state",
    "voided_at",
    "comped_at",
    "refire_of_line_id",
  ]

  const rows: string[] = [header.join(",")]
  const orders = getState().orders
  for (const order of orders) {
    for (const item of order.items) {
      const row = [
        order.id,
        item.lineId,
        order.sessionId,
        order.tagId,
        order.tableNumber,
        order.submittedAt,
        item.itemId,
        item.name,
        item.quantity,
        item.unitPrice.toFixed(2),
        item.vatRate.toFixed(4),
        item.station,
        getItemPrepState(item),
        item.voidedAt ?? "",
        item.compedAt ?? "",
        item.refireOfLineId ?? "",
      ].map(escapeCsvCell)
      rows.push(row.join(","))
    }
  }
  return rows.join("\n")
}

const MENU_CSV_HEADER = [
  "section_id",
  "section_name",
  "item_id",
  "item_name",
  "description",
  "base_price",
  "vat_rate",
  "station",
  "active",
  "stock_count",
]

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]

    if (inQuotes) {
      if (char === "\"") {
        if (csv[i + 1] === "\"") {
          cell += "\""
          i += 1
          continue
        }
        inQuotes = false
        continue
      }
      cell += char
      continue
    }

    if (char === "\"") {
      inQuotes = true
      continue
    }
    if (char === ",") {
      row.push(cell)
      cell = ""
      continue
    }
    if (char === "\n") {
      row.push(cell)
      cell = ""
      if (row.some(value => value.trim() !== "")) {
        rows.push(row)
      }
      row = []
      continue
    }
    if (char === "\r") {
      continue
    }
    cell += char
  }

  if (inQuotes) {
    throw new Error("CSV parse error: unmatched quote")
  }

  row.push(cell)
  if (row.some(value => value.trim() !== "")) {
    rows.push(row)
  }

  return rows
}

function parseMenuCsvBoolean(value: string, lineNumber: number) {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === "" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  ) {
    return true
  }
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no"
  ) {
    return false
  }
  throw new Error(
    `Row ${lineNumber} has invalid active value: ${value}`
  )
}

function parseMenuCsvStockCount(value: string, lineNumber: number) {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === "" ||
    normalized === "null" ||
    normalized === "unlimited"
  ) {
    return null
  }

  const stockCount = Number(normalized)
  if (!Number.isFinite(stockCount) || stockCount < 0) {
    throw new Error(
      `Row ${lineNumber} has invalid stock_count value: ${value}`
    )
  }

  return Math.floor(stockCount)
}

function parseMenuCsvToSections(csv: string) {
  if (typeof csv !== "string" || csv.trim() === "") {
    throw new Error("csv is required")
  }

  const rows = parseCsvRows(csv)
  if (rows.length < 2) {
    throw new Error(
      "CSV must contain a header row and at least one item row"
    )
  }

  const header = rows[0].map(column =>
    column.trim().toLowerCase()
  )
  if (
    header.length !== MENU_CSV_HEADER.length ||
    MENU_CSV_HEADER.some(
      (column, index) => header[index] !== column
    )
  ) {
    throw new Error(
      `CSV header must be: ${MENU_CSV_HEADER.join(",")}`
    )
  }

  const sectionsById = new Map<string, MenuSection>()
  const itemIds = new Set<string>()

  for (let index = 1; index < rows.length; index += 1) {
    const lineNumber = index + 1
    const row = [...rows[index]]
    while (row.length < MENU_CSV_HEADER.length) {
      row.push("")
    }
    if (row.length > MENU_CSV_HEADER.length) {
      throw new Error(`Row ${lineNumber} has too many columns`)
    }

    const [
      sectionIdRaw,
      sectionNameRaw,
      itemIdRaw,
      itemNameRaw,
      descriptionRaw,
      basePriceRaw,
      vatRateRaw,
      stationRaw,
      activeRaw,
      stockCountRaw,
    ] = row

    const sectionId = sectionIdRaw.trim()
    const sectionName = sectionNameRaw.trim()
    const itemId = itemIdRaw.trim()
    const itemName = itemNameRaw.trim()
    const description = descriptionRaw.trim()
    const station = stationRaw.trim()

    if (!sectionId || !sectionName) {
      throw new Error(
        `Row ${lineNumber} is missing section_id or section_name`
      )
    }
    if (!itemId || !itemName || !description) {
      throw new Error(
        `Row ${lineNumber} is missing item_id, item_name, or description`
      )
    }
    if (itemIds.has(itemId)) {
      throw new Error(`Duplicate item_id in CSV: ${itemId}`)
    }
    itemIds.add(itemId)

    const basePrice = Number(basePriceRaw)
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw new Error(
        `Row ${lineNumber} has invalid base_price value: ${basePriceRaw}`
      )
    }

    const vatRate = Number(vatRateRaw)
    if (!Number.isFinite(vatRate) || vatRate < 0) {
      throw new Error(
        `Row ${lineNumber} has invalid vat_rate value: ${vatRateRaw}`
      )
    }

    if (station !== "KITCHEN" && station !== "BAR") {
      throw new Error(
        `Row ${lineNumber} has invalid station value: ${stationRaw}`
      )
    }

    const active = parseMenuCsvBoolean(activeRaw, lineNumber)
    const stockCount = parseMenuCsvStockCount(
      stockCountRaw,
      lineNumber
    )

    let section = sectionsById.get(sectionId)
    if (!section) {
      section = {
        id: sectionId,
        name: sectionName,
        items: [],
      }
      sectionsById.set(sectionId, section)
    } else if (section.name !== sectionName) {
      throw new Error(
        `Section id ${sectionId} is mapped to multiple names`
      )
    }

    section.items.push({
      id: itemId,
      name: itemName,
      description,
      image: null,
      basePrice,
      vatRate,
      allergens: [],
      active: stockCount === 0 ? false : active,
      stockCount,
      station,
    })
  }

  return Array.from(sectionsById.values())
}

export function previewMenuCsvImport(csv: string) {
  const sections = parseMenuCsvToSections(csv)
  const sectionSummaries = sections.map(section => ({
    id: section.id,
    name: section.name,
    itemCount: section.items.length,
  }))
  const itemCount = sections.reduce(
    (sum, section) => sum + section.items.length,
    0
  )
  return {
    sections: sectionSummaries,
    sectionCount: sections.length,
    itemCount,
  }
}

export function importMenuCsv(csv: string) {
  return replaceMenu(parseMenuCsvToSections(csv))
}

export function exportMenuCsv() {
  const rows: string[] = [MENU_CSV_HEADER.join(",")]
  for (const section of getMenuSnapshot({ includeInactive: true }).menu) {
    for (const item of section.items) {
      rows.push(
        [
          section.id,
          section.name,
          item.id,
          item.name,
          item.description,
          item.basePrice.toFixed(2),
          item.vatRate.toFixed(4),
          item.station,
          item.active !== false,
          item.stockCount ?? "",
        ]
          .map(escapeCsvCell)
          .join(",")
      )
    }
  }
  return rows.join("\n")
}

export function exportAuditCsv() {
  const header = [
    "event_id",
    "created_at",
    "actor_role",
    "actor_id",
    "action",
    "target_type",
    "target_id",
    "note",
  ]
  const rows: string[] = [header.join(",")]
  for (const event of getState().auditTrail) {
    rows.push(
      [
        event.id,
        event.createdAt,
        event.actorRole,
        event.actorId,
        event.action,
        event.targetType,
        event.targetId,
        event.note ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  }
  return rows.join("\n")
}

export function getMenuItemMap() {
  const map = new Map<string, MenuItem>()
  for (const section of getMenuSnapshot({ includeInactive: true }).menu) {
    for (const item of section.items) {
      map.set(item.id, item)
    }
  }
  return map
}

export function resetRuntimeStateForTests() {
  const slug = getRestaurantContextSlug()
  stateMap()[slug] = createInitialState(slug)
}


