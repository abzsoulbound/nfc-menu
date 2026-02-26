export type Station = "KITCHEN" | "BAR"
export type StaffRole =
  | "WAITER"
  | "BAR"
  | "KITCHEN"
  | "MANAGER"
  | "ADMIN"

export type SessionOrigin = "CUSTOMER" | "STAFF"

export type TableCloseStatus = "OPEN" | "PAID" | "UNPAID"
export type TableBillStatus = "OPEN" | "PARTIAL" | "PAID" | "UNPAID"
export type PrintJobStatus = "QUEUED" | "PRINTED" | "FAILED"

export type UiMode = "customer" | "staff"

export type QueueUrgency = "normal" | "watch" | "critical"
export type OrderPrepState =
  | "SUBMITTED"
  | "PREPPING"
  | "READY"
  | "DELIVERED"

export type StatusChipVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"

export type FloatingCartState = {
  itemCount: number
  subtotal: number
  isExpanded: boolean
}

export type BrandAssetSlots = {
  logoUrl?: string
  heroUrl?: string
  sectionImageMap?: Record<string, string>
}

export type EditSwap = {
  from: string
  to: string
}

export type EditAddOn = {
  name: string
  priceDelta: number
}

export type ItemEdits = {
  removals?: string[]
  swaps?: EditSwap[]
  addOns?: EditAddOn[]
}

export type EditableOptions = {
  removals?: string[]
  swaps?: EditSwap[]
  addOns?: EditAddOn[]
}

export type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  active?: boolean
  stockCount?: number | null
  editableOptions?: EditableOptions
  station: Station
}

export type MenuSection = {
  id: string
  name: string
  items: MenuItem[]
}

export type TableDTO = {
  id: string
  number: number
  locked: boolean
  stale: boolean
  closed: boolean
  paid: boolean
  openedAt: string
  contributionWindowEndsAt: string
  billStatus?: TableBillStatus
  billTotal?: number
  paidTotal?: number
  splitCount?: number
}

export type TagDTO = {
  id: string
  active: boolean
  tableNumber: number | null
  activeSessionCount: number
  lastSeenAt: string
}

export type SessionDTO = {
  id: string
  origin: SessionOrigin
  tagId: string | null
  tableId: string | null
  lastActivityAt: string
  stale: boolean
}

export type OrderQueueItemDTO = {
  orderId: string
  lineId: string
  tableNumber: number
  name: string
  quantity: number
  station: Station
  edits: ItemEdits | null
  submittedAt: string
  prepState?: "SUBMITTED" | "PREPPING"
  startedAt?: string | null
  voidedAt?: string | null
  compedAt?: string | null
  refireOfLineId?: string | null
}

export type ReadyQueueItemDTO = {
  orderId: string
  lineId: string
  tableNumber: number
  name: string
  quantity: number
  station: Station
  edits: ItemEdits | null
  submittedAt: string
  readyAt?: string | null
  compedAt?: string | null
}

export type OrderReviewGroupDTO = {
  orderId: string
  submittedAt: string
  items: {
    lineId: string
    name: string
    quantity: number
    edits: ItemEdits | null
    submittedAt: string
    state: OrderPrepState
    voidedAt?: string | null
    compedAt?: string | null
    refireOfLineId?: string | null
  }[]
}

export type TableReviewDTO = {
  tableNumber: number
  firstSubmittedAt: string
  initialOrders: OrderReviewGroupDTO[]
  addonOrders: OrderReviewGroupDTO[]
}

export type OrderSubmissionItemDTO = {
  itemId: string
  name: string
  quantity: number
  edits: ItemEdits | null
  allergens: string[]
  unitPrice?: number
  vatRate?: number
  station: Station
}

export type SessionOrderProgressDTO = {
  orderId: string
  tagId: string
  tableNumber: number
  submittedAt: string
  totalItems: number
  states: {
    submitted: number
    prepping: number
    ready: number
    delivered: number
  }
  lines: {
    lineId: string
    itemId: string
    name: string
    quantity: number
    station: Station
    state: OrderPrepState
    voidedAt?: string | null
    compedAt?: string | null
    refireOfLineId?: string | null
  }[]
}

export type TablePaymentEntryDTO = {
  id: string
  tableId: string
  amount: number
  method: string
  status: TableBillStatus
  note?: string
  createdAt: string
}

export type TableBillDTO = {
  tableId: string
  tableNumber: number
  subtotal: number
  vat: number
  total: number
  paidTotal: number
  dueTotal: number
  splitCount: number
  status: TableBillStatus
  entries: TablePaymentEntryDTO[]
}

export type PrintJobDTO = {
  id: string
  tableNumber: number
  station: Station
  status: PrintJobStatus
  attempts: number
  reason: string
  createdAt: string
  updatedAt: string
}

export type AuditEventDTO = {
  id: string
  createdAt: string
  actorRole: StaffRole | "SYSTEM"
  actorId: string
  action: string
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
  note?: string
}

export type ShiftReportDTO = {
  generatedAt: string
  orders: number
  orderLines: number
  totalRevenue: number
  totalVat: number
  byStation: {
    kitchenLines: number
    barLines: number
  }
  performance: {
    avgPrepMinutes: number
    avgReadyToDeliveredMinutes: number
    delayedActiveLines: number
  }
}
