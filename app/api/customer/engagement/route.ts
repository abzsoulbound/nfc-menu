import { badRequest, ok, readJson } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import {
  addWaitlistEntry,
  createFeedback,
  createReservation,
  getCustomerAccount,
  getLoyaltyAccount,
  listCustomerNotifications,
  listPromoCodes,
  upsertCustomerAccount,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

type EngagementAction =
  | "UPSERT_ACCOUNT"
  | "CREATE_RESERVATION"
  | "CREATE_WAITLIST"
  | "CREATE_FEEDBACK"

type EngagementBody = {
  action?: EngagementAction
  customerId?: string | null
  name?: string
  email?: string
  phone?: string
  marketingOptIn?: boolean
  partySize?: number
  requestedFor?: string
  note?: string
  tableNumber?: number | null
  orderId?: string | null
  rating?: number
  comment?: string
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const GET_LIMIT = 90
const POST_LIMIT = 45
const NOTIFICATION_LIMIT = 30

const globalForEngagementRateLimit = globalThis as unknown as {
  __NFC_CUSTOMER_ENGAGEMENT_RATE_LIMIT__?: Map<string, RateLimitBucket>
}

function readClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

function getRateLimitMap() {
  if (!globalForEngagementRateLimit.__NFC_CUSTOMER_ENGAGEMENT_RATE_LIMIT__) {
    globalForEngagementRateLimit.__NFC_CUSTOMER_ENGAGEMENT_RATE_LIMIT__ =
      new Map()
  }
  return globalForEngagementRateLimit.__NFC_CUSTOMER_ENGAGEMENT_RATE_LIMIT__
}

function consumeRateLimit(input: {
  req: Request
  restaurantSlug: string
  scope: string
  limit: number
}) {
  const map = getRateLimitMap()
  const key = `${input.restaurantSlug}|${readClientIp(input.req)}|${input.scope}`
  const now = Date.now()
  if (map.size > 2_000) {
    for (const [entryKey, bucket] of map.entries()) {
      if (bucket.resetAt <= now) {
        map.delete(entryKey)
      }
    }
  }
  const existing = map.get(key)
  if (!existing || existing.resetAt <= now) {
    map.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    })
    return { limited: false, retryAfterSec: 0 }
  }
  if (existing.count >= input.limit) {
    return {
      limited: true,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
    }
  }
  existing.count += 1
  map.set(key, existing)
  return { limited: false, retryAfterSec: 0 }
}

function hasStaffEngagementAccess(req: Request) {
  try {
    requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    return true
  } catch {
    return false
  }
}

function canAccessCustomerId(req: Request, customerId: string) {
  if (hasStaffEngagementAccess(req)) return true
  const claimedCustomerId = req.headers.get("x-customer-id")?.trim()
  return !!claimedCustomerId && claimedCustomerId === customerId
}

function canAccessNotificationRecipient(req: Request, recipient: string) {
  if (hasStaffEngagementAccess(req)) return true
  if (!recipient.startsWith("session:")) return false
  const expectedSessionId = recipient.slice("session:".length).trim()
  if (!expectedSessionId) return false
  const providedSessionId = req.headers.get("x-session-id")?.trim()
  return !!providedSessionId && providedSessionId === expectedSessionId
}

function validatePartySize(value: unknown) {
  const partySize = Number(value)
  if (!Number.isFinite(partySize)) return null
  const normalized = Math.floor(partySize)
  if (normalized < 1 || normalized > 20) return null
  return normalized
}

function validateRating(value: unknown) {
  const rating = Number(value)
  if (!Number.isFinite(rating)) return null
  const normalized = Math.floor(rating)
  if (normalized < 1 || normalized > 5) return null
  return normalized
}

function normalizeInputText(
  value: unknown,
  options: {
    min?: number
    max: number
  }
) {
  const normalized = String(value ?? "").trim()
  if (normalized.length > options.max) return null
  if ((options.min ?? 0) > 0 && normalized.length < (options.min ?? 0)) {
    return null
  }
  return normalized
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(
    req,
    async ({ restaurantSlug, restaurant }) => {
    try {
      const enforceSecurity = !restaurant.isDemo
      if (enforceSecurity) {
        const baseLimit = consumeRateLimit({
          req,
          restaurantSlug,
          scope: "get",
          limit: GET_LIMIT,
        })
        if (baseLimit.limited) {
          return badRequest(
            `Too many requests. Try again in ${baseLimit.retryAfterSec}s`,
            429,
            {
              code: "CUSTOMER_ENGAGEMENT_RATE_LIMITED",
              req,
            }
          )
        }
      }
      await hydrateRuntimeStateFromDb()
      const url = new URL(req.url)
      const view = url.searchParams.get("view")

      if (view === "promos") {
        const includeInactive =
          url.searchParams.get("includeInactive") === "true"
        const promos = listPromoCodes().filter(promo =>
          includeInactive ? true : promo.active
        )
        return ok(promos)
      }

      if (view === "loyalty") {
        const customerId = url.searchParams.get("customerId")
        if (!customerId) {
          return badRequest("customerId is required")
        }
        if (enforceSecurity && !canAccessCustomerId(req, customerId)) {
          return badRequest("Unauthorized: customer access denied", 401, {
            code: "UNAUTHORIZED",
            req,
          })
        }
        return ok({
          account: getCustomerAccount(customerId),
          loyalty: getLoyaltyAccount(customerId),
        })
      }

      if (view === "notifications") {
        const recipient = url.searchParams.get("recipient")
        if (!recipient) {
          return badRequest("recipient is required")
        }
        if (enforceSecurity) {
          const notificationLimit = consumeRateLimit({
            req,
            restaurantSlug,
            scope: "notifications",
            limit: NOTIFICATION_LIMIT,
          })
          if (notificationLimit.limited) {
            return badRequest(
              `Too many notification requests. Try again in ${notificationLimit.retryAfterSec}s`,
              429,
              {
                code: "CUSTOMER_NOTIFICATIONS_RATE_LIMITED",
                req,
              }
            )
          }
        }
        if (
          enforceSecurity &&
          !canAccessNotificationRecipient(req, recipient)
        ) {
          return badRequest(
            "Unauthorized: notification access denied",
            401,
            {
              code: "UNAUTHORIZED",
              req,
            }
          )
        }
        const limitRaw = Number(url.searchParams.get("limit") ?? "50")
        const limit = Number.isFinite(limitRaw)
          ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
          : 50
        return ok(
          listCustomerNotifications({
            recipient,
            limit,
          })
        )
      }

      return badRequest("Unsupported view")
    } catch (error) {
      return badRequest((error as Error).message)
    }
    }
  )
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(
    req,
    async ({ restaurantSlug, restaurant }) => {
    try {
      const enforceSecurity = !restaurant.isDemo
      if (enforceSecurity) {
        const postLimit = consumeRateLimit({
          req,
          restaurantSlug,
          scope: "post",
          limit: POST_LIMIT,
        })
        if (postLimit.limited) {
          return badRequest(
            `Too many requests. Try again in ${postLimit.retryAfterSec}s`,
            429,
            {
              code: "CUSTOMER_ENGAGEMENT_RATE_LIMITED",
              req,
            }
          )
        }
      }

      await hydrateRuntimeStateFromDb()
      const body = await readJson<EngagementBody>(req)
      if (!body.action) {
        return badRequest("action is required")
      }

      if (body.action === "UPSERT_ACCOUNT") {
        if (
          enforceSecurity &&
          body.customerId &&
          !canAccessCustomerId(req, body.customerId)
        ) {
          return badRequest("Unauthorized: customer access denied", 401, {
            code: "UNAUTHORIZED",
            req,
          })
        }
        const name = normalizeInputText(body.name, {
          min: 1,
          max: 80,
        })
        const email = normalizeInputText(body.email, {
          min: 3,
          max: 160,
        })
        const phone = normalizeInputText(body.phone, {
          min: 5,
          max: 32,
        })
        const account = upsertCustomerAccount({
          customerId: body.customerId,
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          marketingOptIn: body.marketingOptIn,
        })
        await persistRuntimeStateToDb()
        return ok(account)
      }

      if (body.action === "CREATE_RESERVATION") {
        const name = normalizeInputText(body.name, {
          min: 2,
          max: 80,
        })
        const phone = normalizeInputText(body.phone, {
          min: 5,
          max: 32,
        })
        const partySize = validatePartySize(body.partySize)
        const requestedFor = normalizeInputText(body.requestedFor, {
          min: 8,
          max: 64,
        })
        if (!name || !phone || !partySize || !requestedFor) {
          return badRequest(
            "name, phone, partySize, and requestedFor are required"
          )
        }
        const reservation = createReservation({
          name,
          phone,
          partySize,
          requestedFor,
          note:
            normalizeInputText(body.note, {
              max: 500,
            }) || undefined,
        })
        await persistRuntimeStateToDb()
        publishRuntimeEvent("reservations.updated", {
          reservationId: reservation.id,
        })
        return ok(reservation)
      }

      if (body.action === "CREATE_WAITLIST") {
        const name = normalizeInputText(body.name, {
          min: 2,
          max: 80,
        })
        const phone = normalizeInputText(body.phone, {
          min: 5,
          max: 32,
        })
        const partySize = validatePartySize(body.partySize)
        if (!name || !phone || !partySize) {
          return badRequest("name, phone, and partySize are required")
        }
        const entry = addWaitlistEntry({
          name,
          phone,
          partySize,
        })
        await persistRuntimeStateToDb()
        publishRuntimeEvent("waitlist.updated", {
          waitlistId: entry.id,
        })
        return ok(entry)
      }

      if (body.action === "CREATE_FEEDBACK") {
        const rating = validateRating(body.rating)
        const comment = normalizeInputText(body.comment, {
          min: 1,
          max: 2000,
        })
        if (!rating || !comment) {
          return badRequest("rating and comment are required")
        }
        if (
          enforceSecurity &&
          body.customerId &&
          !canAccessCustomerId(req, body.customerId)
        ) {
          return badRequest("Unauthorized: customer access denied", 401, {
            code: "UNAUTHORIZED",
            req,
          })
        }
        const feedback = createFeedback({
          tableNumber: body.tableNumber,
          orderId: body.orderId,
          customerId: body.customerId,
          rating,
          comment,
        })
        await persistRuntimeStateToDb()
        publishRuntimeEvent("feedback.created", {
          feedbackId: feedback.id,
        })
        return ok(feedback)
      }

      return badRequest("Unsupported action")
    } catch (error) {
      const message = (error as Error).message
      return badRequest(
        message,
        message.startsWith("Unauthorized") ? 401 : 400
      )
    }
    }
  )
}
