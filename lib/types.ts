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

export type CustomerMenuPageConfig = {
  heroTitle: string
  heroSubtitle: string
  showMetaStats: boolean
  showPlaceholderNote: boolean
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
}

export type CustomerReviewPageConfig = {
  title: string
  subtitleDineIn: string
  subtitleTakeaway: string
  placeOrderLabel: string
  backLabel: string
  confirmDineIn: string
  confirmTakeaway: string
  showAllergens: boolean
}

export type CustomerThemeFontPreset =
  | "SANS"
  | "SERIF"
  | "MONO"

export type CustomerThemeRadiusPreset =
  | "SOFT"
  | "ROUND"
  | "SHARP"

export type CustomerThemeConfig = {
  fontPreset: CustomerThemeFontPreset
  radiusPreset: CustomerThemeRadiusPreset
  customerPrimary: string
  customerSurface: string
  customerText: string
  customerFocus: string
  staffPrimary: string
}

export type CustomerLaunchConfig = {
  isPublished: boolean
}

export type CustomerMenuDiscoveryFlow =
  | "HERO_FIRST"
  | "SECTION_FIRST"
  | "SEARCH_FIRST"

export type CustomerOrderingFlow =
  | "BOTTOM_SHEET_FAST"
  | "INLINE_STEPPER"
  | "GUIDED_CONFIGURATOR"

export type CustomerReviewFlow =
  | "SHEET_REVIEW"
  | "PAGE_REVIEW"

export type CustomerCheckoutFlow =
  | "ONE_PAGE"
  | "GUIDED_SPLIT"
  | "EXPRESS_FIRST"

export type CustomerEngagementFlow =
  | "ALL_IN_ONE"
  | "TASK_TABS"
  | "POST_PURCHASE_PROMPT"

export type CustomerTrustMicrocopyLevel =
  | "MINIMAL"
  | "BALANCED"
  | "HIGH_ASSURANCE"

export type CustomerExperiencePresetId =
  | "FAST_CASUAL_TRUSTED"
  | "FULL_SERVICE_ASSURANCE"
  | "BAR_LOUNGE_SAFE_EXPRESS"

export type CustomerOrderSafetyMode = "STANDARD" | "STRICT"
export type CustomerCheckoutSafetyMode = "STANDARD" | "STRICT"

export type CustomerSocialProofMode =
  | "OFF"
  | "VERIFIED_REVIEWS"
  | "VERIFIED_USAGE"

export type CustomerTipPresetStrategy =
  | "CONSERVATIVE"
  | "BALANCED"
  | "PREMIUM"

export type CustomerUxConfig = {
  presetId: CustomerExperiencePresetId
  menuDiscovery: CustomerMenuDiscoveryFlow
  ordering: CustomerOrderingFlow
  review: CustomerReviewFlow
  checkout: CustomerCheckoutFlow
  engagement: CustomerEngagementFlow
  orderSafetyMode: CustomerOrderSafetyMode
  checkoutSafetyMode: CustomerCheckoutSafetyMode
  socialProofMode: CustomerSocialProofMode
  tipPresetStrategy: CustomerTipPresetStrategy
  showProgressAnchors: boolean
  emphasizeSocialProof: boolean
  trustMicrocopy: CustomerTrustMicrocopyLevel
  defaultTipPercent: number
}

export type CustomerExperienceConfig = {
  menu: CustomerMenuPageConfig
  review: CustomerReviewPageConfig
  theme: CustomerThemeConfig
  launch: CustomerLaunchConfig
  ux: CustomerUxConfig
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

export type WalletMethod = "APPLE_PAY" | "GOOGLE_PAY" | "CARD"

export type CustomerAccountDTO = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  marketingOptIn: boolean
  favoriteItemIds: string[]
  createdAt: string
  lastSeenAt: string
}

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD"

export type LoyaltyAccountDTO = {
  customerId: string
  points: number
  lifetimeSpend: number
  tier: LoyaltyTier
  lastUpdatedAt: string
}

export type PromoCodeKind = "PERCENT" | "FIXED"

export type PromoCodeDTO = {
  code: string
  description: string
  kind: PromoCodeKind
  value: number
  minSpend: number
  active: boolean
  startsAt: string | null
  endsAt: string | null
  maxUses: number | null
  usedCount: number
}

export type ReservationStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "SEATED"
  | "CANCELLED"

export type ReservationDTO = {
  id: string
  name: string
  phone: string
  partySize: number
  requestedFor: string
  note?: string
  status: ReservationStatus
  createdAt: string
}

export type WaitlistStatus =
  | "WAITING"
  | "NOTIFIED"
  | "SEATED"
  | "CANCELLED"

export type WaitlistEntryDTO = {
  id: string
  name: string
  phone: string
  partySize: number
  createdAt: string
  notifiedAt: string | null
  status: WaitlistStatus
}

export type CustomerNotificationChannel =
  | "SMS"
  | "EMAIL"
  | "IN_APP"

export type CustomerNotificationDTO = {
  id: string
  channel: CustomerNotificationChannel
  recipient: string
  message: string
  relatedType: string
  relatedId: string
  createdAt: string
}

export type FeedbackDTO = {
  id: string
  tableNumber: number | null
  orderId: string | null
  customerId: string | null
  rating: number
  comment: string
  createdAt: string
}

export type DeliveryChannel = "UBER_EATS" | "DELIVEROO" | "JUST_EAT" | "DIRECT"
export type DeliveryOrderStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "PREPARING"
  | "READY"
  | "DISPATCHED"
  | "CANCELLED"

export type DeliveryChannelOrderDTO = {
  id: string
  channel: DeliveryChannel
  externalRef: string
  status: DeliveryOrderStatus
  total: number
  createdAt: string
}

export type MenuDaypartDTO = {
  id: string
  name: string
  enabled: boolean
  days: number[]
  startTime: string
  endTime: string
  sectionIds: string[]
  itemIds: string[]
}

export type CustomerCheckoutQuoteDTO = {
  tableId: string
  tableNumber: number
  dueTotal: number
  splitCount: number
  suggestedShareAmount: number
}

export type CustomerCheckoutReceiptDTO = {
  receiptId: string
  tableId: string
  tableNumber: number
  amount: number
  tipAmount: number
  totalCharged: number
  method: WalletMethod
  email: string | null
  promoCode: string | null
  loyaltyRedeemedPoints: number
  loyaltyEarnedPoints: number
  createdAt: string
}

export type FeatureSummaryDTO = {
  reservations: number
  waitlist: number
  promos: number
  feedback: number
  notifications: number
  loyaltyMembers: number
  deliveryOrders: number
}

export type UxExperimentStatus =
  | "DRAFT"
  | "LIVE"
  | "PAUSED"
  | "ARCHIVED"

export type UxExperimentVariant = {
  key: string
  label: string
  weight: number
  uxPatch?: Partial<CustomerUxConfig>
}

export type UxExperimentDTO = {
  id: string
  key: string
  name: string
  description: string | null
  status: UxExperimentStatus
  trafficPercent: number
  variants: UxExperimentVariant[]
  createdAt: string
  updatedAt: string
}

export type UxExperimentAssignmentDTO = {
  experimentKey: string
  variantKey: string
  sessionId: string
  assignedAt: string
}

export type UxFunnelEventDTO = {
  id: string
  experimentKey: string | null
  variantKey: string | null
  sessionId: string
  eventName: string
  page: string
  step: string
  value: number | null
  metadata: Record<string, unknown> | null
  occurredAt: string
}

export type UxInsightsVariantSummary = {
  variantKey: string
  sessions: number
  eventCounts: Record<string, number>
}

export type UxInsightsDTO = {
  experimentKey: string
  since: string
  until: string
  totalSessions: number
  totalEvents: number
  variants: UxInsightsVariantSummary[]
}

export type TenantScopedEntity = {
  restaurantId: string
}

export type SetupBootstrapPayload = {
  preferredSlug?: string | null
  location?: string | null
  logoUrl?: string | null
  heroUrl?: string | null
  menuCsv?: string | null
  tableCount?: number
  notes?: string | null
}

export type SetupChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type OnboardingNextAction = {
  label: string
  href: string
  role: StaffRole | "CUSTOMER"
}

export type OnboardingResult = {
  restaurant: {
    slug: string
    name: string
    monogram: string
    location: string | null
    isDemo: boolean
    planTier: string
    billingStatus: string
  }
  launchUrl: string
  staffLoginUrl: string
  initialCredentials: {
    passcodes: Record<StaffRole, string[]>
  }
  checklist: {
    score: number
    items: SetupChecklistItem[]
  }
  nextActions: OnboardingNextAction[]
}

export type ApiErrorEnvelope = {
  code: string
  message: string
  requestId: string
  details?: unknown
}

export type RolePermissionMatrix = Record<
  StaffRole,
  {
    routes: string[]
    apiScopes: string[]
  }
>

export type LaunchChecklistItem = {
  id: string
  label: string
  done: boolean
  detail: string
}

export type LaunchReadiness = {
  ready: boolean
  score: number
  items: LaunchChecklistItem[]
}
