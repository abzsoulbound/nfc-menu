import {
  badRequest,
  getRequestId,
  ok,
  readJson,
} from "@/lib/http"
import { finalizeCustomerCheckout } from "@/lib/customerCheckout"
import { getPaymentMode } from "@/lib/env"
import { logApi } from "@/lib/logger"
import { fetchStripePaymentIntentForRestaurant } from "@/lib/payments"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { assertRestaurantSubscriptionActive } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

type Body = {
  paymentIntentId?: string
}

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
            "External checkout completion is only available for production tenants",
            400,
            {
              code: "CHECKOUT_COMPLETE_UNAVAILABLE",
              req,
            }
          )
        }

        const body = await readJson<Body>(req)
        const paymentIntentId = body.paymentIntentId?.trim() ?? ""
        if (!paymentIntentId) {
          return badRequest("paymentIntentId is required", 400, {
            code: "CHECKOUT_PAYMENT_INTENT_REQUIRED",
            req,
          })
        }

        const recovered = await fetchStripePaymentIntentForRestaurant({
          restaurant,
          paymentIntentId,
        })
        if (recovered.restaurantSlug !== restaurantSlug) {
          return badRequest("Payment intent tenant mismatch", 409, {
            code: "CHECKOUT_TENANT_MISMATCH",
            req,
          })
        }
        if (recovered.status !== "succeeded") {
          return badRequest(
            `Payment intent is ${recovered.status}, not succeeded`,
            409,
            {
              code: "CHECKOUT_PAYMENT_NOT_SETTLED",
              req,
              details: {
                status: recovered.status,
              },
            }
          )
        }

        const { result } = await finalizeCustomerCheckout({
          restaurantSlug,
          isDemo: restaurant.isDemo,
          checkout: recovered.checkout,
          preparedCheckout: recovered.preparedCheckout,
          providerResult: recovered.providerResult,
        })

        logApi(
          "INFO",
          "checkout.completed.external",
          {
            requestId,
            restaurantSlug,
            route: "/api/customer/checkout/complete",
            latencyMs: Date.now() - startedAt,
            statusCode: 200,
          },
          {
            tableNumber: result.receipt.tableNumber,
            paymentIntentId,
            receiptId: result.receipt.receiptId,
          }
        )

        return ok(result, undefined, req)
      } catch (error) {
        const message = (error as Error).message
        logApi(
          "ERROR",
          "checkout.complete.failed",
          {
            requestId,
            restaurantSlug,
            route: "/api/customer/checkout/complete",
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
          code: "CHECKOUT_COMPLETE_FAILED",
          req,
          }
        )
      }
    }
  )
}
