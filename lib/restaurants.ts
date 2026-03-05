import { createHash, randomBytes } from "crypto"
import { cookies, headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import type {
  BrandAssetSlots,
  CustomerExperienceConfig,
  SetupBootstrapPayload,
  SetupChecklistItem,
  StaffRole,
} from "@/lib/types"
import {
  customerExperienceDefaultsForRestaurant,
  sanitizeCustomerExperienceConfig,
} from "@/lib/customerExperience"
import {
  getDefaultRestaurantSlug,
  getSalesDemoSlug,
  inferRestaurantSlugFromHost,
  isSalesDemoSlug,
  isTenantOverrideAllowedInRequestResolution,
  normalizeRestaurantSlug,
  readCookieValue,
  RESTAURANT_COOKIE_NAME,
} from "@/lib/tenant"

export type RestaurantStaffAuth = Record<StaffRole, string[]>

export type RestaurantPaymentProfile = {
  provider: "SIMULATED" | "STRIPE_CONNECT_STANDARD"
  stripeAccountId: string | null
  stripeAccountStatus: "DISCONNECTED" | "PENDING" | "RESTRICTED" | "CONNECTED"
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  platformFeeBps: number
}

export type RestaurantSubscriptionProfile = {
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: string
  active: boolean
}

export type RestaurantProfile = {
  slug: string
  name: string
  monogram: string
  location: string | null
  assets: BrandAssetSlots
  experienceConfig: CustomerExperienceConfig
  payment: RestaurantPaymentProfile
  subscription: RestaurantSubscriptionProfile
  isDemo: boolean
  planTier: string
  billingStatus: string
}

export type NamedStaffAccount = {
  username: string
  role: Extract<StaffRole, "MANAGER" | "ADMIN">
  passcode: string
}

type StoredNamedStaffAccount = {
  username: string
  role: Extract<StaffRole, "MANAGER" | "ADMIN">
  passcodeHash: string
}

const ROLE_PRIORITY: StaffRole[] = [
  "ADMIN",
  "MANAGER",
  "KITCHEN",
  "BAR",
  "WAITER",
]

const PASSCODE_HASH_PREFIX = "sha256:v1:"
const PASSCODE_HASH_PATTERN = /^sha256:v1:[a-f0-9]{64}$/
const PASSCODE_DIGIT_PATTERN = /^\d{4}$/

const DEFAULT_PASSCODES: RestaurantStaffAuth = {
  WAITER: ["1111"],
  BAR: ["3333"],
  KITCHEN: ["2222"],
  MANAGER: ["4444"],
  ADMIN: ["9999"],
}

const FALLBACK_PROFILE_BASE = {
  name: "Restaurant Template",
  monogram: "RT",
  location: null as string | null,
  assets: {
    logoUrl: undefined,
    heroUrl: undefined,
  } satisfies BrandAssetSlots,
  experienceConfig: customerExperienceDefaultsForRestaurant({
    slug: getDefaultRestaurantSlug(),
    isDemo: true,
  }),
  payment: {
    provider: "SIMULATED",
    stripeAccountId: null,
    stripeAccountStatus: "DISCONNECTED",
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    platformFeeBps: 0,
  } satisfies RestaurantPaymentProfile,
  subscription: {
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    status: "TRIALING",
    active: true,
  } satisfies RestaurantSubscriptionProfile,
  isDemo: true,
  planTier: "starter",
  billingStatus: "trial",
}

const globalForRestaurants = globalThis as unknown as {
  __NFC_RESTAURANT_BOOTSTRAP_DONE__?: boolean
  __NFC_RESTAURANT_BOOTSTRAP_NEXT_ATTEMPT_AT__?: number
  __NFC_RESTAURANT_DB_DISABLED_UNTIL__?: number
}

function canUseDatabase() {
  return !!process.env.DATABASE_URL
}

function canReadRestaurantDb() {
  if (!canUseDatabase()) return false
  const disabledUntil =
    globalForRestaurants.__NFC_RESTAURANT_DB_DISABLED_UNTIL__ ?? 0
  return Date.now() >= disabledUntil
}

function markRestaurantDbFailure() {
  globalForRestaurants.__NFC_RESTAURANT_DB_DISABLED_UNTIL__ =
    Date.now() + 30_000
}

function isFourDigitPasscode(value: string) {
  return PASSCODE_DIGIT_PATTERN.test(value)
}

function isHashedPasscode(value: string) {
  return PASSCODE_HASH_PATTERN.test(value)
}

function hashPasscode(passcode: string) {
  return `${PASSCODE_HASH_PREFIX}${createHash("sha256")
    .update(`staff-passcode:v1:${passcode}`)
    .digest("hex")}`
}

function normalizeStoredPasscode(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (isFourDigitPasscode(normalized)) return normalized
  if (isHashedPasscode(normalized)) return normalized
  return null
}

function verifyPasscode(stored: string, candidate: string) {
  if (!isFourDigitPasscode(candidate)) return false
  if (isFourDigitPasscode(stored)) {
    return stored === candidate
  }
  if (isHashedPasscode(stored)) {
    return stored === hashPasscode(candidate)
  }
  return false
}

function splitCodes(raw: string | undefined) {
  if (!raw || raw.trim() === "" || raw === "changeme") {
    return []
  }
  return raw
    .split(",")
    .map(code => code.trim())
    .filter(code => isFourDigitPasscode(code))
}

function envFallbackStaffAuth(): RestaurantStaffAuth {
  const waiterCodes = splitCodes(process.env.WAITER_PASSCODES)
  const staffShared = splitCodes(process.env.STAFF_AUTH_SECRET)
  return {
    WAITER: waiterCodes.length > 0 ? waiterCodes : staffShared,
    BAR: splitCodes(process.env.BAR_PASSCODES),
    KITCHEN: splitCodes(process.env.KITCHEN_PASSCODES),
    MANAGER: splitCodes(process.env.MANAGER_PASSCODES),
    ADMIN: splitCodes(process.env.ADMIN_PASSCODES),
  }
}

function hasAnyPasscodes(auth: RestaurantStaffAuth) {
  return ROLE_PRIORITY.some(role => auth[role].length > 0)
}

function emptyStaffAuth(): RestaurantStaffAuth {
  return {
    WAITER: [],
    BAR: [],
    KITCHEN: [],
    MANAGER: [],
    ADMIN: [],
  }
}

function runtimeFallbackStaffAuth() {
  const envAuth = envFallbackStaffAuth()
  if (hasAnyPasscodes(envAuth)) {
    return envAuth
  }
  if (process.env.NODE_ENV === "production") {
    return emptyStaffAuth()
  }
  return DEFAULT_PASSCODES
}

function parseStaffAuth(value: unknown): RestaurantStaffAuth | null {
  if (!value || typeof value !== "object") return null
  const input = value as Partial<Record<StaffRole, unknown>>
  const result = emptyStaffAuth()
  for (const role of ROLE_PRIORITY) {
    const roleValue = input[role]
    if (!Array.isArray(roleValue)) continue
    result[role] = roleValue
      .map(normalizeStoredPasscode)
      .filter((entry): entry is string => entry !== null)
  }
  return result
}

function hasLegacyPlaintextStaffAuth(auth: RestaurantStaffAuth) {
  return ROLE_PRIORITY.some(role =>
    auth[role].some(code => isFourDigitPasscode(code))
  )
}

function hashStaffAuthForStorage(auth: RestaurantStaffAuth) {
  const hashed = emptyStaffAuth()
  for (const role of ROLE_PRIORITY) {
    const normalized = auth[role]
      .map(normalizeStoredPasscode)
      .filter((entry): entry is string => entry !== null)
    hashed[role] = Array.from(
      new Set(
        normalized.map(entry =>
          isFourDigitPasscode(entry)
            ? hashPasscode(entry)
            : entry
        )
      )
    )
  }
  return hashed
}

function parseNamedStaffAccounts(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(entry => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Partial<{
        username: string
        role: Extract<StaffRole, "MANAGER" | "ADMIN">
        passcode?: string
        passcodeHash?: string
      }>
      const username = String(record.username ?? "").trim().toLowerCase()
      const passcode = String(record.passcode ?? "").trim()
      const passcodeHash = String(record.passcodeHash ?? "")
        .trim()
        .toLowerCase()
      const role = record.role
      if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) return null
      if (role !== "MANAGER" && role !== "ADMIN") return null
      const normalizedHash = isHashedPasscode(passcodeHash)
        ? passcodeHash
        : isFourDigitPasscode(passcode)
          ? hashPasscode(passcode)
          : null
      if (!normalizedHash) return null
      return {
        username,
        passcodeHash: normalizedHash,
        role,
      } satisfies StoredNamedStaffAccount
    })
    .filter(
      (entry): entry is StoredNamedStaffAccount => entry !== null
    )
}

function hasLegacyNamedStaffAccountPasscodes(
  value: unknown
) {
  if (!Array.isArray(value)) return false
  return value.some(entry => {
    if (!entry || typeof entry !== "object") return false
    const passcode = String(
      (entry as { passcode?: unknown }).passcode ?? ""
    ).trim()
    return isFourDigitPasscode(passcode)
  })
}

function hashNamedStaffAccountsForStorage(
  accounts: NamedStaffAccount[]
) {
  return accounts.map(account => ({
    username: account.username,
    role: account.role,
    passcodeHash: hashPasscode(account.passcode),
  })) satisfies StoredNamedStaffAccount[]
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function deriveMonogram(name: string) {
  const parts = name
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return "RM"
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function slugifyName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalizeRestaurantSlug(base) ?? null
}

async function uniqueSlug(baseSlug: string) {
  let suffix = 0
  while (suffix < 1000) {
    const candidate =
      suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
    const existing = await prisma.restaurant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    suffix += 1
  }
  throw new Error("Unable to allocate unique restaurant slug")
}

function sanitizeOptionalUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed === "") return null
  if (trimmed.startsWith("/")) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}

function isSubscriptionActiveStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toUpperCase()
  return normalized === "ACTIVE" || normalized === "TRIALING"
}

function toProfile(input: {
  slug: string
  name: string
  monogram: string
  location: string | null
  logoUrl: string | null
  heroUrl: string | null
  experienceConfig?: unknown
  stripeAccountId?: string | null
  stripeAccountStatus?: string | null
  stripeChargesEnabled?: boolean
  stripePayoutsEnabled?: boolean
  stripeDetailsSubmitted?: boolean
  platformFeeBps?: number
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  subscriptionStatus?: string | null
  isDemo: boolean
  planTier?: string
  billingStatus?: string
}): RestaurantProfile {
  const defaultExperience = customerExperienceDefaultsForRestaurant({
    slug: input.slug,
    isDemo: input.isDemo,
  })
  const paymentProviderRaw =
    process.env.PAYMENT_PROVIDER?.trim().toUpperCase() ?? ""
  const prefersStripeConnect =
    !input.isDemo &&
    (paymentProviderRaw === "STRIPE" ||
      paymentProviderRaw === "STRIPE_CONNECT" ||
      paymentProviderRaw === "STRIPE_CONNECT_STANDARD" ||
      paymentProviderRaw === "STRIPE_CONNECT_DESTINATION")
  return {
    slug: input.slug,
    name: input.name,
    monogram: input.monogram,
    location: input.location ?? null,
    assets: {
      logoUrl: input.logoUrl ?? undefined,
      heroUrl: input.heroUrl ?? undefined,
    },
    experienceConfig: sanitizeCustomerExperienceConfig(
      input.experienceConfig,
      {
        defaults: defaultExperience,
      }
    ),
    payment: {
      provider: prefersStripeConnect
        ? "STRIPE_CONNECT_STANDARD"
        : "SIMULATED",
      stripeAccountId: input.stripeAccountId ?? null,
      stripeAccountStatus:
        input.isDemo && !input.stripeAccountId
          ? "DISCONNECTED"
          : (input.stripeAccountStatus as RestaurantPaymentProfile["stripeAccountStatus"] | null) ??
            "DISCONNECTED",
      chargesEnabled: input.stripeChargesEnabled === true,
      payoutsEnabled: input.stripePayoutsEnabled === true,
      detailsSubmitted: input.stripeDetailsSubmitted === true,
      platformFeeBps: Math.max(
        0,
        Math.min(10_000, Math.floor(input.platformFeeBps ?? 0))
      ),
    },
    subscription: {
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      status: input.subscriptionStatus?.trim() || "TRIALING",
      active:
        input.isDemo ||
        isSubscriptionActiveStatus(input.subscriptionStatus ?? "TRIALING"),
    },
    isDemo: input.isDemo,
    planTier: input.planTier ?? "starter",
    billingStatus: input.billingStatus ?? "trial",
  }
}

function fallbackProfile(slug: string): RestaurantProfile {
  const salesDemo = isSalesDemoSlug(slug)
  const experienceConfig = customerExperienceDefaultsForRestaurant({
    slug,
    isDemo: true,
  })
  return {
    slug,
    ...FALLBACK_PROFILE_BASE,
    name: salesDemo ? "Sales Demo Restaurant" : FALLBACK_PROFILE_BASE.name,
    monogram: salesDemo ? "SD" : FALLBACK_PROFILE_BASE.monogram,
    location: salesDemo ? "Live demo environment" : FALLBACK_PROFILE_BASE.location,
    experienceConfig,
  }
}

function fallbackProfilesForCoreTenants() {
  const defaultSlug = getDefaultRestaurantSlug()
  const salesDemoSlug = getSalesDemoSlug()
  if (defaultSlug === salesDemoSlug) {
    return [fallbackProfile(defaultSlug)]
  }
  return [fallbackProfile(defaultSlug), fallbackProfile(salesDemoSlug)]
}

function randomPasscode(used: Set<string>) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(code)) {
      used.add(code)
      return code
    }
  }
  throw new Error("Unable to generate passcode")
}

function generateStaffPasscodes() {
  const used = new Set<string>()
  return {
    WAITER: [randomPasscode(used), randomPasscode(used)],
    BAR: [randomPasscode(used)],
    KITCHEN: [randomPasscode(used)],
    MANAGER: [randomPasscode(used)],
    ADMIN: [randomPasscode(used)],
  } satisfies RestaurantStaffAuth
}

function sanitizeBootstrapPayload(
  value: SetupBootstrapPayload | null | undefined
) {
  if (!value || typeof value !== "object") return null
  const preferredSlug = normalizeRestaurantSlug(value.preferredSlug ?? "")
  const menuCsv =
    typeof value.menuCsv === "string" && value.menuCsv.trim() !== ""
      ? value.menuCsv.trim()
      : null
  const notes =
    typeof value.notes === "string" && value.notes.trim() !== ""
      ? value.notes.trim()
      : null
  const tableCountRaw = Number(value.tableCount)
  const tableCount = Number.isFinite(tableCountRaw)
    ? Math.max(1, Math.min(80, Math.floor(tableCountRaw)))
    : undefined
  return {
    preferredSlug: preferredSlug ?? null,
    location:
      value.location && value.location.trim() !== ""
        ? value.location.trim()
        : null,
    logoUrl: sanitizeOptionalUrl(value.logoUrl),
    heroUrl: sanitizeOptionalUrl(value.heroUrl),
    menuCsv,
    tableCount,
    notes,
  } satisfies SetupBootstrapPayload
}

function defaultChecklist(): SetupChecklistItem[] {
  return [
    { id: "profile", label: "Restaurant profile configured", done: true },
    { id: "staff", label: "Initial staff passcodes issued", done: true },
    { id: "menu", label: "Menu loaded", done: true },
    { id: "floor", label: "Tables and tags scaffolded", done: true },
    { id: "payments", label: "Payment mode configured", done: true },
  ]
}

function checklistScore(items: SetupChecklistItem[]) {
  if (items.length === 0) return 0
  const done = items.filter(item => item.done).length
  return Math.round((done / items.length) * 100)
}

function generateNamedStaffAccounts(staffAuth: RestaurantStaffAuth) {
  return [
    {
      username: "manager",
      role: "MANAGER",
      passcode: staffAuth.MANAGER[0] ?? "4444",
    },
    {
      username: "admin",
      role: "ADMIN",
      passcode: staffAuth.ADMIN[0] ?? "9999",
    },
  ] satisfies NamedStaffAccount[]
}

export async function ensureBootstrapRestaurants() {
  if (!canUseDatabase()) return
  if (globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_DONE__) return
  const nowMs = Date.now()
  if (
    globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_NEXT_ATTEMPT_AT__ &&
    nowMs <
      globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_NEXT_ATTEMPT_AT__
  ) {
    return
  }

  const seededAuth = runtimeFallbackStaffAuth()
  const seededStoredAuth = hashStaffAuthForStorage(seededAuth)
  const defaultSlug = getDefaultRestaurantSlug()
  const salesDemoSlug = getSalesDemoSlug()

  try {
    await prisma.restaurant.upsert({
      where: { slug: salesDemoSlug },
      update: {
        name: "Sales Demo Restaurant",
        monogram: "SD",
        location: "Live demo environment",
        logoUrl: null,
        heroUrl: null,
        experienceConfig: customerExperienceDefaultsForRestaurant({
          slug: salesDemoSlug,
          isDemo: true,
        }),
        stripeAccountId: null,
        stripeAccountStatus: "DISCONNECTED",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        platformFeeBps: 0,
        planTier: "starter",
        billingStatus: "trial",
        isDemo: true,
      },
      create: {
        slug: salesDemoSlug,
        name: "Sales Demo Restaurant",
        monogram: "SD",
        location: "Live demo environment",
        logoUrl: null,
        heroUrl: null,
        staffAuth: seededStoredAuth,
        experienceConfig: customerExperienceDefaultsForRestaurant({
          slug: salesDemoSlug,
          isDemo: true,
        }),
        stripeAccountId: null,
        stripeAccountStatus: "DISCONNECTED",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        platformFeeBps: 0,
        planTier: "starter",
        billingStatus: "trial",
        isDemo: true,
      },
    })

    if (defaultSlug !== salesDemoSlug) {
      await prisma.restaurant.upsert({
        where: { slug: defaultSlug },
        update: {
          name: "Restaurant Template",
          monogram: "RT",
          location: null,
          logoUrl: null,
          heroUrl: null,
          experienceConfig: customerExperienceDefaultsForRestaurant({
            slug: defaultSlug,
            isDemo: true,
          }),
          stripeAccountId: null,
          stripeAccountStatus: "DISCONNECTED",
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          platformFeeBps: 0,
          planTier: "starter",
          billingStatus: "trial",
          isDemo: true,
        },
        create: {
          slug: defaultSlug,
          name: "Restaurant Template",
          monogram: "RT",
          location: null,
          logoUrl: null,
          heroUrl: null,
          staffAuth: seededStoredAuth,
          experienceConfig: customerExperienceDefaultsForRestaurant({
            slug: defaultSlug,
            isDemo: true,
          }),
          stripeAccountId: null,
          stripeAccountStatus: "DISCONNECTED",
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          platformFeeBps: 0,
          planTier: "starter",
          billingStatus: "trial",
          isDemo: true,
        },
      })
    }

    globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_DONE__ = true
    globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_NEXT_ATTEMPT_AT__ =
      undefined
  } catch {
    // App still runs with in-memory fallback profile when DB is unavailable.
    globalForRestaurants.__NFC_RESTAURANT_BOOTSTRAP_NEXT_ATTEMPT_AT__ =
      Date.now() + 30_000
  }
}

export async function getRestaurantBySlug(slug: string) {
  if (!canReadRestaurantDb()) return null
  try {
    const row = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        slug: true,
        name: true,
        monogram: true,
        location: true,
        logoUrl: true,
        heroUrl: true,
        experienceConfig: true,
        stripeAccountId: true,
        stripeAccountStatus: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        platformFeeBps: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        isDemo: true,
        planTier: true,
        billingStatus: true,
        active: true,
      },
    })
    if (!row || !row.active) return null
    return toProfile({
      slug: row.slug,
      name: row.name,
      monogram: row.monogram,
      location: row.location,
      logoUrl: row.logoUrl,
      heroUrl: row.heroUrl,
      experienceConfig: row.experienceConfig,
      stripeAccountId: row.stripeAccountId,
      stripeAccountStatus: row.stripeAccountStatus,
      stripeChargesEnabled: row.stripeChargesEnabled,
      stripePayoutsEnabled: row.stripePayoutsEnabled,
      stripeDetailsSubmitted: row.stripeDetailsSubmitted,
      platformFeeBps: row.platformFeeBps,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      subscriptionStatus: row.subscriptionStatus,
      isDemo: row.isDemo,
      planTier: row.planTier,
      billingStatus: row.billingStatus,
    })
  } catch {
    markRestaurantDbFailure()
    return null
  }
}

export async function updateRestaurantBrandingAndExperience(input: {
  slug: string
  name?: string
  location?: string | null
  logoUrl?: string | null
  heroUrl?: string | null
  experienceConfig?: CustomerExperienceConfig | null
  platformFeeBps?: number
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for restaurant updates")
  }

  const slug =
    normalizeRestaurantSlug(input.slug) ?? getDefaultRestaurantSlug()

  const existing = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      monogram: true,
      location: true,
      logoUrl: true,
      heroUrl: true,
      experienceConfig: true,
      stripeAccountId: true,
      stripeAccountStatus: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      platformFeeBps: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      isDemo: true,
      planTier: true,
      billingStatus: true,
      active: true,
    },
  })

  if (!existing || !existing.active) {
    throw new Error("Restaurant was not found")
  }

  const data: {
    name?: string
    monogram?: string
    location?: string | null
    logoUrl?: string | null
    heroUrl?: string | null
    experienceConfig?: CustomerExperienceConfig
    platformFeeBps?: number
  } = {}

  if (typeof input.name === "string") {
    const name = input.name.trim()
    if (name.length < 2 || name.length > 80) {
      throw new Error("Restaurant name must be 2-80 characters")
    }
    data.name = name
    data.monogram = deriveMonogram(name)
  }

  if (input.location !== undefined) {
    const locationRaw = String(input.location ?? "").trim()
    if (locationRaw.length > 120) {
      throw new Error("Location must be 120 characters or fewer")
    }
    data.location = locationRaw === "" ? null : locationRaw
  }

  if (input.logoUrl !== undefined) {
    const candidate = String(input.logoUrl ?? "").trim()
    const normalized = sanitizeOptionalUrl(input.logoUrl)
    if (candidate !== "" && normalized === null) {
      throw new Error(
        "logoUrl must be an absolute http(s) URL or a path starting with /"
      )
    }
    data.logoUrl = normalized
  }

  if (input.heroUrl !== undefined) {
    const candidate = String(input.heroUrl ?? "").trim()
    const normalized = sanitizeOptionalUrl(input.heroUrl)
    if (candidate !== "" && normalized === null) {
      throw new Error(
        "heroUrl must be an absolute http(s) URL or a path starting with /"
      )
    }
    data.heroUrl = normalized
  }

  if (input.experienceConfig !== undefined) {
    const restaurantDefaults = customerExperienceDefaultsForRestaurant({
      slug: existing.slug,
      isDemo: existing.isDemo,
    })
    const baseline = sanitizeCustomerExperienceConfig(
      existing.experienceConfig,
      {
        defaults: restaurantDefaults,
      }
    )
    data.experienceConfig =
      input.experienceConfig === null
        ? restaurantDefaults
        : sanitizeCustomerExperienceConfig(input.experienceConfig, {
            defaults: baseline,
          })
  }

  if (input.platformFeeBps !== undefined) {
    const feeBps = Number(input.platformFeeBps)
    const normalized = Math.max(
      0,
      Math.min(
        10_000,
        Number.isFinite(feeBps) ? Math.floor(feeBps) : 0
      )
    )
    data.platformFeeBps = normalized
  }

  if (Object.keys(data).length === 0) {
    return toProfile({
      slug: existing.slug,
      name: existing.name,
      monogram: existing.monogram,
      location: existing.location,
      logoUrl: existing.logoUrl,
      heroUrl: existing.heroUrl,
      experienceConfig: existing.experienceConfig,
      stripeAccountId: existing.stripeAccountId,
      stripeAccountStatus: existing.stripeAccountStatus,
      stripeChargesEnabled: existing.stripeChargesEnabled,
      stripePayoutsEnabled: existing.stripePayoutsEnabled,
      stripeDetailsSubmitted: existing.stripeDetailsSubmitted,
      platformFeeBps: existing.platformFeeBps,
      stripeCustomerId: existing.stripeCustomerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      subscriptionStatus: existing.subscriptionStatus,
      isDemo: existing.isDemo,
      planTier: existing.planTier,
      billingStatus: existing.billingStatus,
    })
  }

  const updated = await prisma.restaurant.update({
    where: { slug },
    data,
    select: {
      slug: true,
      name: true,
      monogram: true,
      location: true,
      logoUrl: true,
      heroUrl: true,
      experienceConfig: true,
      stripeAccountId: true,
      stripeAccountStatus: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      platformFeeBps: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      isDemo: true,
      planTier: true,
      billingStatus: true,
    },
  })

  return toProfile({
    slug: updated.slug,
    name: updated.name,
    monogram: updated.monogram,
    location: updated.location,
    logoUrl: updated.logoUrl,
    heroUrl: updated.heroUrl,
    experienceConfig: updated.experienceConfig,
    stripeAccountId: updated.stripeAccountId,
    stripeAccountStatus: updated.stripeAccountStatus,
    stripeChargesEnabled: updated.stripeChargesEnabled,
    stripePayoutsEnabled: updated.stripePayoutsEnabled,
    stripeDetailsSubmitted: updated.stripeDetailsSubmitted,
    platformFeeBps: updated.platformFeeBps,
    stripeCustomerId: updated.stripeCustomerId,
    stripeSubscriptionId: updated.stripeSubscriptionId,
    subscriptionStatus: updated.subscriptionStatus,
    isDemo: updated.isDemo,
    planTier: updated.planTier,
    billingStatus: updated.billingStatus,
  })
}

export async function updateRestaurantStripeConnection(input: {
  slug: string
  stripeAccountId: string
  stripeAccountStatus: "PENDING" | "RESTRICTED" | "CONNECTED"
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for Stripe connection")
  }

  const slug =
    normalizeRestaurantSlug(input.slug) ?? getDefaultRestaurantSlug()

  const updated = await prisma.restaurant.update({
    where: { slug },
    data: {
      stripeAccountId: input.stripeAccountId,
      stripeAccountStatus: input.stripeAccountStatus,
      stripeChargesEnabled: input.stripeChargesEnabled,
      stripePayoutsEnabled: input.stripePayoutsEnabled,
      stripeDetailsSubmitted: input.stripeDetailsSubmitted,
    },
    select: {
      slug: true,
      name: true,
      monogram: true,
      location: true,
      logoUrl: true,
      heroUrl: true,
      experienceConfig: true,
      stripeAccountId: true,
      stripeAccountStatus: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      platformFeeBps: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      isDemo: true,
      planTier: true,
      billingStatus: true,
    },
  })

  return toProfile({
    slug: updated.slug,
    name: updated.name,
    monogram: updated.monogram,
    location: updated.location,
    logoUrl: updated.logoUrl,
    heroUrl: updated.heroUrl,
    experienceConfig: updated.experienceConfig,
    stripeAccountId: updated.stripeAccountId,
    stripeAccountStatus: updated.stripeAccountStatus,
    stripeChargesEnabled: updated.stripeChargesEnabled,
    stripePayoutsEnabled: updated.stripePayoutsEnabled,
    stripeDetailsSubmitted: updated.stripeDetailsSubmitted,
    platformFeeBps: updated.platformFeeBps,
    stripeCustomerId: updated.stripeCustomerId,
    stripeSubscriptionId: updated.stripeSubscriptionId,
    subscriptionStatus: updated.subscriptionStatus,
    isDemo: updated.isDemo,
    planTier: updated.planTier,
    billingStatus: updated.billingStatus,
  })
}

export async function upsertRestaurantStripeCustomer(input: {
  slug: string
  stripeCustomerId: string
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for Stripe customer updates")
  }

  await prisma.restaurant.update({
    where: {
      slug: normalizeRestaurantSlug(input.slug) ?? getDefaultRestaurantSlug(),
    },
    data: {
      stripeCustomerId: input.stripeCustomerId,
    },
  })
}

export async function updateRestaurantSubscriptionState(input: {
  slug: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  subscriptionStatus: string
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for subscription updates")
  }

  const slug =
    normalizeRestaurantSlug(input.slug) ?? getDefaultRestaurantSlug()

  const updated = await prisma.restaurant.update({
    where: { slug },
    data: {
      stripeCustomerId:
        input.stripeCustomerId === undefined
          ? undefined
          : input.stripeCustomerId,
      stripeSubscriptionId:
        input.stripeSubscriptionId === undefined
          ? undefined
          : input.stripeSubscriptionId,
      subscriptionStatus:
        input.subscriptionStatus.trim().toUpperCase() || "INACTIVE",
    },
    select: {
      slug: true,
      name: true,
      monogram: true,
      location: true,
      logoUrl: true,
      heroUrl: true,
      experienceConfig: true,
      stripeAccountId: true,
      stripeAccountStatus: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      platformFeeBps: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      isDemo: true,
      planTier: true,
      billingStatus: true,
    },
  })

  return toProfile({
    slug: updated.slug,
    name: updated.name,
    monogram: updated.monogram,
    location: updated.location,
    logoUrl: updated.logoUrl,
    heroUrl: updated.heroUrl,
    experienceConfig: updated.experienceConfig,
    stripeAccountId: updated.stripeAccountId,
    stripeAccountStatus: updated.stripeAccountStatus,
    stripeChargesEnabled: updated.stripeChargesEnabled,
    stripePayoutsEnabled: updated.stripePayoutsEnabled,
    stripeDetailsSubmitted: updated.stripeDetailsSubmitted,
    platformFeeBps: updated.platformFeeBps,
    stripeCustomerId: updated.stripeCustomerId,
    stripeSubscriptionId: updated.stripeSubscriptionId,
    subscriptionStatus: updated.subscriptionStatus,
    isDemo: updated.isDemo,
    planTier: updated.planTier,
    billingStatus: updated.billingStatus,
  })
}

export function assertRestaurantSubscriptionActive(
  restaurant: RestaurantProfile
) {
  if (restaurant.isDemo) {
    return
  }
  if (restaurant.subscription.active) {
    return
  }
  throw new Error(
    `Subscription is ${restaurant.subscription.status.toLowerCase()}. Complete billing to continue.`
  )
}

export async function resolveRestaurantForSlug(slug: string) {
  const normalized =
    normalizeRestaurantSlug(slug) ?? getDefaultRestaurantSlug()
  const found = await getRestaurantBySlug(normalized)
  if (found) return found

  const defaultSlug = getDefaultRestaurantSlug()
  const salesDemoSlug = getSalesDemoSlug()
  if (normalized === defaultSlug || normalized === salesDemoSlug) {
    return fallbackProfile(normalized)
  }
  const fallback = await getRestaurantBySlug(defaultSlug)
  if (fallback) return fallback
  return fallbackProfile(defaultSlug)
}

export async function requireRestaurantForSlug(slug: string) {
  const normalized = normalizeRestaurantSlug(slug)
  if (!normalized) {
    throw new Error("Restaurant was not found")
  }

  const found = await getRestaurantBySlug(normalized)
  if (found) {
    return found
  }

  const defaultSlug = getDefaultRestaurantSlug()
  const salesDemoSlug = getSalesDemoSlug()
  if (normalized === defaultSlug || normalized === salesDemoSlug) {
    return fallbackProfile(normalized)
  }

  throw new Error("Restaurant was not found")
}

export async function listActiveRestaurants(limit = 200) {
  if (!canReadRestaurantDb()) {
    return fallbackProfilesForCoreTenants()
  }

  try {
    const rows = await prisma.restaurant.findMany({
      where: { active: true },
      orderBy: [
        { isDemo: "desc" },
        { createdAt: "asc" },
      ],
      take: Math.max(1, Math.min(limit, 500)),
      select: {
        slug: true,
        name: true,
        monogram: true,
        location: true,
        logoUrl: true,
        heroUrl: true,
        experienceConfig: true,
        stripeAccountId: true,
        stripeAccountStatus: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        platformFeeBps: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        isDemo: true,
        planTier: true,
        billingStatus: true,
      },
    })

    if (rows.length === 0) {
      return fallbackProfilesForCoreTenants()
    }

    return rows.map(row =>
      toProfile({
        slug: row.slug,
        name: row.name,
        monogram: row.monogram,
        location: row.location,
        logoUrl: row.logoUrl,
        heroUrl: row.heroUrl,
        experienceConfig: row.experienceConfig,
        stripeAccountId: row.stripeAccountId,
        stripeAccountStatus: row.stripeAccountStatus,
        stripeChargesEnabled: row.stripeChargesEnabled,
        stripePayoutsEnabled: row.stripePayoutsEnabled,
        stripeDetailsSubmitted: row.stripeDetailsSubmitted,
        platformFeeBps: row.platformFeeBps,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        subscriptionStatus: row.subscriptionStatus,
        isDemo: row.isDemo,
        planTier: row.planTier,
        billingStatus: row.billingStatus,
      })
    )
  } catch {
    markRestaurantDbFailure()
    return fallbackProfilesForCoreTenants()
  }
}

export type CoreTenantConsistency = {
  ok: boolean
  defaultSlug: string
  salesDemoSlug: string
  missing: string[]
  inactive: string[]
  error: string | null
}

export async function checkCoreTenantConsistency(): Promise<CoreTenantConsistency> {
  const defaultSlug = getDefaultRestaurantSlug()
  const salesDemoSlug = getSalesDemoSlug()
  const requiredSlugs = Array.from(
    new Set([defaultSlug, salesDemoSlug])
  )

  if (!canUseDatabase()) {
    return {
      ok: false,
      defaultSlug,
      salesDemoSlug,
      missing: requiredSlugs,
      inactive: [],
      error: "Database is unavailable for tenant consistency checks",
    }
  }

  try {
    const rows = await prisma.restaurant.findMany({
      where: {
        slug: {
          in: requiredSlugs,
        },
      },
      select: {
        slug: true,
        active: true,
      },
    })

    const rowBySlug = new Map(
      rows.map(row => [row.slug, row.active] as const)
    )
    const missing = requiredSlugs.filter(
      slug => !rowBySlug.has(slug)
    )
    const inactive = requiredSlugs.filter(
      slug => rowBySlug.get(slug) === false
    )

    return {
      ok: missing.length === 0 && inactive.length === 0,
      defaultSlug,
      salesDemoSlug,
      missing,
      inactive,
      error: null,
    }
  } catch {
    markRestaurantDbFailure()
    return {
      ok: false,
      defaultSlug,
      salesDemoSlug,
      missing: requiredSlugs,
      inactive: [],
      error: "Failed to read tenant records from database",
    }
  }
}

export async function findRestaurantSlugByStripeCustomerId(
  stripeCustomerId: string
) {
  const normalizedCustomerId = stripeCustomerId.trim()
  if (!normalizedCustomerId) return null
  if (!canReadRestaurantDb()) return null

  try {
    const row = await prisma.restaurant.findFirst({
      where: {
        stripeCustomerId: normalizedCustomerId,
        active: true,
      },
      select: {
        slug: true,
      },
    })

    return row?.slug ?? null
  } catch {
    markRestaurantDbFailure()
    return null
  }
}

export async function findRestaurantSlugByStripeAccountId(
  stripeAccountId: string
) {
  const normalizedAccountId = stripeAccountId.trim()
  if (!normalizedAccountId) return null
  if (!canReadRestaurantDb()) return null

  try {
    const row = await prisma.restaurant.findFirst({
      where: {
        stripeAccountId: normalizedAccountId,
        active: true,
      },
      select: {
        slug: true,
      },
    })

    return row?.slug ?? null
  } catch {
    markRestaurantDbFailure()
    return null
  }
}

export async function getRestaurantForCurrentRequest() {
  const requestHeaders = headers()
  const requestCookies = cookies()
  const allowTenantOverride =
    isTenantOverrideAllowedInRequestResolution()

  const fromHeader = normalizeRestaurantSlug(
    requestHeaders.get("x-restaurant-slug")
  )
  const fromCookie = normalizeRestaurantSlug(
    requestCookies.get(RESTAURANT_COOKIE_NAME)?.value ??
      readCookieValue(
        requestHeaders.get("cookie"),
        RESTAURANT_COOKIE_NAME
      )
  )
  const fromHost = inferRestaurantSlugFromHost(
    requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host")
  )
  const candidate =
    (allowTenantOverride ? fromHeader : null) ??
    fromCookie ??
    fromHost ??
    getDefaultRestaurantSlug()

  return resolveRestaurantForSlug(candidate)
}

export async function getRestaurantStaffAuth(slug: string) {
  const normalized =
    normalizeRestaurantSlug(slug) ?? getDefaultRestaurantSlug()
  const demoAuth = envFallbackStaffAuth()

  // Sales demos should always use explicit env passcodes when provided
  // so the live pitch page and login flow stay aligned.
  if (isSalesDemoSlug(normalized) && hasAnyPasscodes(demoAuth)) {
    return demoAuth
  }

  if (!canUseDatabase()) {
    return runtimeFallbackStaffAuth()
  }
  if (!canReadRestaurantDb()) {
    return runtimeFallbackStaffAuth()
  }
  try {
    const row = await prisma.restaurant.findUnique({
      where: { slug: normalized },
      select: { staffAuth: true, active: true, isDemo: true },
    })
    if (!row || !row.active) {
      return runtimeFallbackStaffAuth()
    }
    if (row.isDemo && hasAnyPasscodes(demoAuth)) {
      return demoAuth
    }
    const parsed = parseStaffAuth(row.staffAuth)
    if (!parsed || !hasAnyPasscodes(parsed)) {
      return runtimeFallbackStaffAuth()
    }

    if (hasLegacyPlaintextStaffAuth(parsed)) {
      const hashed = hashStaffAuthForStorage(parsed)
      try {
        await prisma.restaurant.update({
          where: { slug: normalized },
          data: { staffAuth: hashed },
        })
      } catch {
        // Keep auth online even if background migration write fails.
      }
      return hashed
    }

    return parsed
  } catch {
    markRestaurantDbFailure()
    return runtimeFallbackStaffAuth()
  }
}

export async function resolveRestaurantRoleForPasscode(
  slug: string,
  passcode: string
) {
  const auth = await getRestaurantStaffAuth(slug)
  const normalizedPasscode = passcode.trim()
  if (!isFourDigitPasscode(normalizedPasscode)) {
    return null
  }
  for (const role of ROLE_PRIORITY) {
    if (
      auth[role].some(stored =>
        verifyPasscode(stored, normalizedPasscode)
      )
    ) {
      return role
    }
  }
  return null
}

export async function resolveRestaurantRoleForCredentials(input: {
  slug: string
  username: string
  passcode: string
}) {
  if (!canReadRestaurantDb()) return null

  const normalizedSlug =
    normalizeRestaurantSlug(input.slug) ?? getDefaultRestaurantSlug()
  const username = input.username.trim().toLowerCase()
  const passcode = input.passcode.trim()

  if (!username || !passcode || !isFourDigitPasscode(passcode)) {
    return null
  }

  try {
    const row = await prisma.restaurant.findUnique({
      where: { slug: normalizedSlug },
      select: {
        active: true,
        staffAccounts: true,
      },
    })
    if (!row || !row.active) return null

    const accounts = parseNamedStaffAccounts(row.staffAccounts)
    if (hasLegacyNamedStaffAccountPasscodes(row.staffAccounts)) {
      try {
        await prisma.restaurant.update({
          where: { slug: normalizedSlug },
          data: {
            staffAccounts: accounts,
          },
        })
      } catch {
        // Keep login online even if background migration write fails.
      }
    }
    const match = accounts.find(
      account =>
        account.username === username &&
        verifyPasscode(account.passcodeHash, passcode)
    )
    return match?.role ?? null
  } catch {
    markRestaurantDbFailure()
    return null
  }
}

export async function createRestaurantSetupToken(input?: {
  expiresInHours?: number
  createdBy?: string | null
  bootstrap?: SetupBootstrapPayload | null
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for setup links")
  }

  const expiresInHoursRaw = input?.expiresInHours ?? 72
  const expiresInHours = Math.max(
    1,
    Math.min(24 * 14, Math.floor(expiresInHoursRaw))
  )
  const token = randomBytes(24).toString("base64url")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000
  )
  const bootstrap = sanitizeBootstrapPayload(input?.bootstrap)

  await prisma.restaurantSetupToken.create({
    data: {
      tokenHash,
      createdBy: input?.createdBy ?? null,
      expiresAt,
      bootstrap: bootstrap ?? undefined,
    },
  })

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  }
}

export type RestaurantSetupStatus = {
  valid: boolean
  state: "READY" | "EXPIRED" | "CONSUMED" | "INVALID"
  expiresAt: string | null
  consumedAt: string | null
  bootstrap: SetupBootstrapPayload | null
  restaurant: RestaurantProfile | null
}

export async function getRestaurantSetupStatus(token: string): Promise<RestaurantSetupStatus> {
  const normalized = token.trim()
  if (normalized.length < 16) {
    return {
      valid: false,
      state: "INVALID",
      expiresAt: null,
      consumedAt: null,
      bootstrap: null,
      restaurant: null,
    }
  }
  if (!canUseDatabase()) {
    return {
      valid: false,
      state: "INVALID",
      expiresAt: null,
      consumedAt: null,
      bootstrap: null,
      restaurant: null,
    }
  }

  const tokenHash = hashToken(normalized)
  const row = await prisma.restaurantSetupToken.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      consumedAt: true,
      bootstrap: true,
      restaurant: {
        select: {
          slug: true,
          name: true,
          monogram: true,
          location: true,
          logoUrl: true,
          heroUrl: true,
          experienceConfig: true,
          stripeAccountId: true,
          stripeAccountStatus: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          stripeDetailsSubmitted: true,
          platformFeeBps: true,
          isDemo: true,
          planTier: true,
          billingStatus: true,
        },
      },
    },
  })

  if (!row) {
    return {
      valid: false,
      state: "INVALID",
      expiresAt: null,
      consumedAt: null,
      bootstrap: null,
      restaurant: null,
    }
  }

  const now = Date.now()
  const consumedAt = row.consumedAt?.toISOString() ?? null
  const expiresAt = row.expiresAt.toISOString()
  const state: RestaurantSetupStatus["state"] = row.consumedAt
    ? "CONSUMED"
    : row.expiresAt.getTime() < now
      ? "EXPIRED"
      : "READY"

  return {
    valid: state === "READY",
    state,
    expiresAt,
    consumedAt,
    bootstrap: sanitizeBootstrapPayload(
      row.bootstrap as SetupBootstrapPayload | null | undefined
    ),
    restaurant: row.restaurant
      ? toProfile({
          slug: row.restaurant.slug,
          name: row.restaurant.name,
          monogram: row.restaurant.monogram,
          location: row.restaurant.location,
          logoUrl: row.restaurant.logoUrl,
          heroUrl: row.restaurant.heroUrl,
          experienceConfig: row.restaurant.experienceConfig,
          stripeAccountId: row.restaurant.stripeAccountId,
          stripeAccountStatus: row.restaurant.stripeAccountStatus,
          stripeChargesEnabled: row.restaurant.stripeChargesEnabled,
          stripePayoutsEnabled: row.restaurant.stripePayoutsEnabled,
          stripeDetailsSubmitted: row.restaurant.stripeDetailsSubmitted,
          platformFeeBps: row.restaurant.platformFeeBps,
          isDemo: row.restaurant.isDemo,
          planTier: row.restaurant.planTier,
          billingStatus: row.restaurant.billingStatus,
        })
      : null,
  }
}

export async function completeRestaurantSetup(input: {
  token: string
  name: string
  slug?: string | null
  location?: string | null
  logoUrl?: string | null
  heroUrl?: string | null
  planTier?: string | null
}) {
  if (!canUseDatabase()) {
    throw new Error("Database is required for setup")
  }

  const token = input.token.trim()
  if (token.length < 16) {
    throw new Error("Invalid setup token")
  }

  const name = input.name.trim()
  if (name.length < 2 || name.length > 80) {
    throw new Error("Restaurant name must be 2-80 characters")
  }

  const requestedSlug = normalizeRestaurantSlug(input.slug ?? "")
  const nameSlug = slugifyName(name)

  const tokenHash = hashToken(token)
  const now = new Date()

  const result = await prisma.$transaction(async tx => {
    const setupToken = await tx.restaurantSetupToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        consumedAt: true,
        expiresAt: true,
        bootstrap: true,
      },
    })

    if (!setupToken) {
      throw new Error("Setup token was not found")
    }
    if (setupToken.consumedAt) {
      throw new Error("Setup token has already been used")
    }
    if (setupToken.expiresAt.getTime() < now.getTime()) {
      throw new Error("Setup token has expired")
    }

    const bootstrap = sanitizeBootstrapPayload(
      setupToken.bootstrap as SetupBootstrapPayload | null | undefined
    )
    const baseSlug =
      requestedSlug ??
      normalizeRestaurantSlug(bootstrap?.preferredSlug ?? "") ??
      nameSlug ??
      `restaurant-${randomBytes(2).toString("hex")}`

    const slug = await uniqueSlug(baseSlug)
    const staffAuth = generateStaffPasscodes()
    const namedAccounts = generateNamedStaffAccounts(staffAuth)
    const storedStaffAuth = hashStaffAuthForStorage(staffAuth)
    const storedNamedAccounts =
      hashNamedStaffAccountsForStorage(namedAccounts)
    const checklist = defaultChecklist()
    const onboardingScore = checklistScore(checklist)
    const inputLocation =
      input.location && input.location.trim() !== ""
        ? input.location.trim()
        : null
    const inputLogoUrl = sanitizeOptionalUrl(input.logoUrl)
    const inputHeroUrl = sanitizeOptionalUrl(input.heroUrl)
    const planTierRaw = input.planTier?.trim().toLowerCase()
    const planTier =
      planTierRaw && planTierRaw !== "" ? planTierRaw : "starter"

    const restaurant = await tx.restaurant.create({
      data: {
        slug,
        name,
        monogram: deriveMonogram(name),
        location: inputLocation ?? bootstrap?.location ?? null,
        logoUrl: inputLogoUrl ?? bootstrap?.logoUrl ?? null,
        heroUrl: inputHeroUrl ?? bootstrap?.heroUrl ?? null,
        experienceConfig: customerExperienceDefaultsForRestaurant({
          slug,
          isDemo: false,
        }),
        staffAuth: storedStaffAuth,
        staffAccounts: storedNamedAccounts,
        stripeAccountId: null,
        stripeAccountStatus: "DISCONNECTED",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        platformFeeBps: 0,
        planTier,
        billingStatus: "trial",
        onboardingChecklist: checklist,
        onboardingScore,
        isDemo: false,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        monogram: true,
        location: true,
        logoUrl: true,
        heroUrl: true,
        experienceConfig: true,
        stripeAccountId: true,
        stripeAccountStatus: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        platformFeeBps: true,
        isDemo: true,
        planTier: true,
        billingStatus: true,
        onboardingChecklist: true,
        onboardingScore: true,
      },
    })

    await tx.restaurantSetupToken.update({
      where: { tokenHash },
      data: {
        consumedAt: now,
        restaurantId: restaurant.id,
        uses: {
          increment: 1,
        },
      },
    })

    return {
      restaurant: toProfile({
        slug: restaurant.slug,
        name: restaurant.name,
        monogram: restaurant.monogram,
        location: restaurant.location,
        logoUrl: restaurant.logoUrl,
        heroUrl: restaurant.heroUrl,
        experienceConfig: restaurant.experienceConfig,
        stripeAccountId: restaurant.stripeAccountId,
        stripeAccountStatus: restaurant.stripeAccountStatus,
        stripeChargesEnabled: restaurant.stripeChargesEnabled,
        stripePayoutsEnabled: restaurant.stripePayoutsEnabled,
        stripeDetailsSubmitted: restaurant.stripeDetailsSubmitted,
        platformFeeBps: restaurant.platformFeeBps,
        isDemo: restaurant.isDemo,
        planTier: restaurant.planTier,
        billingStatus: restaurant.billingStatus,
      }),
      staffAuth,
      namedAccounts,
      checklist: {
        items: (restaurant.onboardingChecklist as SetupChecklistItem[]) ?? checklist,
        score: restaurant.onboardingScore ?? onboardingScore,
      },
      bootstrap,
    }
  })

  return result
}
