import { badRequest, ok, readJson } from "@/lib/http"
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

export async function GET(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const url = new URL(req.url)
    const view = url.searchParams.get("view")

    if (view === "promos") {
      const includeInactive = url.searchParams.get("includeInactive") === "true"
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
      const limitRaw = Number(url.searchParams.get("limit") ?? "50")
      const limit = Number.isFinite(limitRaw) ? limitRaw : 50
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

export async function POST(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<EngagementBody>(req)
    if (!body.action) {
      return badRequest("action is required")
    }

    if (body.action === "UPSERT_ACCOUNT") {
      const account = upsertCustomerAccount({
        customerId: body.customerId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        marketingOptIn: body.marketingOptIn,
      })
      await persistRuntimeStateToDb()
      return ok(account)
    }

    if (body.action === "CREATE_RESERVATION") {
      if (
        !body.name ||
        !body.phone ||
        typeof body.partySize !== "number" ||
        !body.requestedFor
      ) {
        return badRequest("name, phone, partySize, and requestedFor are required")
      }
      const reservation = createReservation({
        name: body.name,
        phone: body.phone,
        partySize: body.partySize,
        requestedFor: body.requestedFor,
        note: body.note,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("reservations.updated", {
        reservationId: reservation.id,
      })
      return ok(reservation)
    }

    if (body.action === "CREATE_WAITLIST") {
      if (!body.name || !body.phone || typeof body.partySize !== "number") {
        return badRequest("name, phone, and partySize are required")
      }
      const entry = addWaitlistEntry({
        name: body.name,
        phone: body.phone,
        partySize: body.partySize,
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("waitlist.updated", {
        waitlistId: entry.id,
      })
      return ok(entry)
    }

    if (body.action === "CREATE_FEEDBACK") {
      if (typeof body.rating !== "number" || !body.comment) {
        return badRequest("rating and comment are required")
      }
      const feedback = createFeedback({
        tableNumber: body.tableNumber,
        orderId: body.orderId,
        customerId: body.customerId,
        rating: body.rating,
        comment: body.comment,
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
    return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400)
  }
}
