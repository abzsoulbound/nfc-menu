import {
  badRequest,
  getRequestId,
  ok,
  readJson,
} from "@/lib/http"
import {
  normalizeCheckoutRequest,
  type CheckoutRequestBody,
} from "@/lib/customerCheckout"
import { getPaymentMode } from "@/lib/env"
import { logApi } from "@/lib/logger"
import {
  appendPaymentLedgerEvent,
  createExternalCheckoutIntent,
} from "@/lib/payments"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { previewCustomerCheckout } from "@/lib/runtimeStore"
import { assertRestaurantSubscriptionActive } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

type Body = CheckoutRequestBody

export async function POST(req: Request) {
  return withRestaurantRequestContext(
    req,
    async ({ restaurant, restaurantSlug }) => {
      const requestId = getRequestId(req)
      const startedAt = Date.now()

      try {
        assertRestaurantSubscriptionActive(restaurant)
        if (restaurant.isDemo || getPaymentMode() !== "EXTERNAL") {
          return badRequest(
            "External checkout intents are only available for production tenants",
            400,
            {
              code: "CHECKOUT_INTENT_UNAVAILABLE",
              req,
            }
          )
        }

        const body = await readJson<Body>(req)
        const checkout = normalizeCheckoutRequest({
          body,
          req,
          isDemo: restaurant.isDemo,
        })
        const prepared = previewCustomerCheckout(checkout)
        const intent = await createExternalCheckoutIntent({
          restaurant,
          prepared,
        })

        await appendPaymentLedgerEvent({
          restaurantSlug,
          tableNumber: prepared.tableNumber,
          eventType: "CHECKOUT_INTENT_CREATED",
          amount: prepared.totalCharged,
          method: prepared.method,
          provider: intent.provider,
          providerRef: intent.paymentIntentId,
          metadata: {
            applicationFeeAmount: intent.applicationFeeAmount,
            idempotencyKey: checkout.idempotencyKey ?? null,
          },
        })

        logApi(
          "INFO",
          "checkout.intent.created",
          {
            requestId,
            restaurantSlug,
            route: "/api/customer/checkout/intent",
            latencyMs: Date.now() - startedAt,
            statusCode: 200,
          },
          {
            tableNumber: prepared.tableNumber,
            paymentIntentId: intent.paymentIntentId,
          }
        )

        return ok(
          {
            checkout: {
              tableNumber: prepared.tableNumber,
              amount: prepared.amount,
              tipAmount: prepared.tipAmount,
              totalCharged: prepared.totalCharged,
            },
            paymentIntent: intent,
          },
          undefined,
          req
        )
      } catch (error) {
        const message = (error as Error).message
        logApi(
          "ERROR",
          "checkout.intent.failed",
          {
            requestId,
            restaurantSlug,
            route: "/api/customer/checkout/intent",
            latencyMs: Date.now() - startedAt,
            statusCode: 400,
          },
          {
            error: message,
          }
        )

        return badRequest(
          message,
          message.startsWith("Subscription is ") ? 402 : 400,
          {
          code: "CHECKOUT_INTENT_FAILED",
          req,
          }
        )
      }
    }
  )
}
