import {
  badRequest,
  getRequestId,
  ok,
  readJson,
} from "@/lib/http"
import { requireRole } from "@/lib/auth"
import {
  finalizeCustomerCheckout,
  normalizeCheckoutRequest,
  type CheckoutRequestBody,
} from "@/lib/customerCheckout"
import { getPaymentMode } from "@/lib/env"
import {
  addTableRefund,
  getCustomerCheckoutQuoteByTableNumber,
  getTableBill,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import {
  appendPaymentLedgerEvent,
} from "@/lib/payments"
import { logApi } from "@/lib/logger"
import { assertRestaurantSubscriptionActive } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

type CheckoutBody = CheckoutRequestBody

type RefundBody = {
  tableNumber?: number
  amount?: number
  reason?: string
  receiptId?: string | null
  method?: string | null
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant, restaurantSlug }) => {
    const requestId = getRequestId(req)
    try {
      assertRestaurantSubscriptionActive(restaurant)
      await hydrateRuntimeStateFromDb()
      const url = new URL(req.url)
      const tableNumber = Number(url.searchParams.get("tableNumber"))
      if (!Number.isFinite(tableNumber)) {
        return badRequest("tableNumber is required", 400, {
          code: "CHECKOUT_TABLE_REQUIRED",
          req,
        })
      }
      return ok(getCustomerCheckoutQuoteByTableNumber(tableNumber), undefined, req)
    } catch (error) {
      logApi("ERROR", "checkout.quote.failed", {
        requestId,
        restaurantSlug,
        route: "/api/customer/checkout",
      }, {
        error: (error as Error).message,
      })
      const message = (error as Error).message
      const status = message.startsWith("Subscription is ") ? 402 : 400
      return badRequest(message, status, {
        code: "CHECKOUT_QUOTE_FAILED",
        req,
      })
    }
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant, restaurantSlug }) => {
    const startedAt = Date.now()
    const requestId = getRequestId(req)
    try {
      assertRestaurantSubscriptionActive(restaurant)
      const body = await readJson<CheckoutBody>(req)
      if (!restaurant.isDemo && getPaymentMode() === "EXTERNAL") {
        return badRequest(
          "Create a Stripe PaymentIntent first via /api/customer/checkout/intent",
          409,
          {
            code: "CHECKOUT_INTENT_REQUIRED",
            req,
          }
        )
      }

      const checkout = normalizeCheckoutRequest({
        body,
        req,
        isDemo: restaurant.isDemo,
      })
      const { result } = await finalizeCustomerCheckout({
        restaurantSlug,
        isDemo: restaurant.isDemo,
        checkout,
      })

      logApi("INFO", "checkout.completed", {
        requestId,
        restaurantSlug,
        route: "/api/customer/checkout",
        latencyMs: Date.now() - startedAt,
        statusCode: 200,
      }, {
        tableNumber: result.receipt.tableNumber,
        receiptId: result.receipt.receiptId,
        idempotencyReplay: result.idempotencyReplay,
      })

      return ok(result, undefined, req)
    } catch (error) {
      const message = (error as Error).message
      logApi("ERROR", "checkout.failed", {
        requestId,
        restaurantSlug,
        route: "/api/customer/checkout",
        latencyMs: Date.now() - startedAt,
        statusCode: message.startsWith("Unauthorized") ? 401 : 400,
      }, {
        error: message,
      })
      return badRequest(
        message,
        message.startsWith("Unauthorized")
          ? 401
          : message.startsWith("Subscription is ")
            ? 402
            : 400,
        {
          code: message.startsWith("Unauthorized")
            ? "UNAUTHORIZED"
            : "CHECKOUT_FAILED",
          req,
        }
      )
    }
  })
}

export async function PUT(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    const requestId = getRequestId(req)
    try {
      const staff = requireRole(["MANAGER", "ADMIN"], req)
      await hydrateRuntimeStateFromDb()
      const body = await readJson<RefundBody>(req)
      const tableNumber = Number(body.tableNumber)
      const amount = Number(body.amount)

      if (!Number.isFinite(tableNumber)) {
        return badRequest("tableNumber is required", 400, {
          code: "REFUND_TABLE_REQUIRED",
          req,
        })
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return badRequest("amount must be greater than zero", 400, {
          code: "REFUND_AMOUNT_INVALID",
          req,
        })
      }

      const quote = getCustomerCheckoutQuoteByTableNumber(tableNumber)
      const currentBill = getTableBill(quote.tableId)
      if (currentBill.paidTotal <= 0) {
        return badRequest("No paid balance available for refund", 400, {
          code: "REFUND_BALANCE_EMPTY",
          req,
        })
      }
      if (amount > currentBill.paidTotal) {
        return badRequest("Refund amount exceeds paid balance", 400, {
          code: "REFUND_AMOUNT_EXCEEDS_PAID",
          req,
          details: {
            maxRefundable: currentBill.paidTotal,
          },
        })
      }

      const bill = addTableRefund({
        tableId: quote.tableId,
        amount,
        method: body.method ?? "refund",
        note: body.reason ?? "Refund issued",
      })
      await persistRuntimeStateToDb()
      publishRuntimeEvent("billing.updated", {
        tableId: quote.tableId,
      })

      await appendPaymentLedgerEvent({
        restaurantSlug,
        tableNumber,
        receiptId: body.receiptId ?? null,
        eventType: "CHECKOUT_REFUND",
        amount: amount * -1,
        method: body.method ?? "refund",
        reason: body.reason ?? null,
        actorRole: staff.role,
        actorId: staff.id,
      })

      logApi("WARN", "checkout.refund", {
        requestId,
        restaurantSlug,
        actorRole: staff.role,
        route: "/api/customer/checkout",
        statusCode: 200,
      }, {
        tableNumber,
        amount,
        reason: body.reason ?? null,
      })

      return ok(
        {
          ok: true,
          bill,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400, {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "REFUND_FAILED",
        req,
      })
    }
  })
}
