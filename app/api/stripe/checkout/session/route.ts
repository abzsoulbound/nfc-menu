import { badRequest, ok, readJson } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import {
  getOrderForCheckoutSession,
  updateOrderStripePaymentState,
} from "@/lib/runtimeStore"
import {
  createDirectCheckoutSessionForConnectedAccount,
} from "@/lib/stripeConnectBilling"
import { persistOrderStripeIds } from "@/lib/stripeBillingStore"

export const dynamic = "force-dynamic"

type Body = {
  restaurantId?: string
  orderId?: string
  successUrl?: string
  cancelUrl?: string
}

function hasCheckoutAccess(req: Request, sessionId: string) {
  try {
    requireRole(["WAITER", "MANAGER", "ADMIN"], req)
    return true
  } catch {
    const providedSessionId = req.headers
      .get("x-session-id")
      ?.trim()
    return !!providedSessionId && providedSessionId === sessionId
  }
}

function resolveSafeRedirectUrl(input: {
  candidate: string | undefined
  origin: string
  fallbackPath: string
}) {
  const fallback = `${input.origin}${input.fallbackPath}`
  const raw = input.candidate?.trim()
  if (!raw) return fallback

  try {
    const parsed = new URL(raw, input.origin)
    if (parsed.origin !== input.origin) {
      return fallback
    }
    return parsed.toString()
  } catch {
    return fallback
  }
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      const body = await readJson<Body>(req)
      const requestedRestaurantId = body.restaurantId?.trim().toLowerCase()
      if (
        requestedRestaurantId &&
        requestedRestaurantId !== restaurant.slug
      ) {
        return badRequest("restaurantId does not match request tenant", 409, {
          code: "STRIPE_CHECKOUT_TENANT_MISMATCH",
          req,
        })
      }

      const orderId = body.orderId?.trim() ?? ""
      if (!orderId) {
        return badRequest("orderId is required", 400, {
          code: "STRIPE_CHECKOUT_ORDER_REQUIRED",
          req,
        })
      }

      if (!restaurant.payment.stripeAccountId) {
        return badRequest("Restaurant has not connected Stripe yet", 400, {
          code: "STRIPE_ACCOUNT_NOT_CONNECTED",
          req,
        })
      }

      const order = getOrderForCheckoutSession(orderId)
      if (!restaurant.isDemo && !hasCheckoutAccess(req, order.sessionId)) {
        return badRequest("Unauthorized: checkout access denied", 401, {
          code: "UNAUTHORIZED",
          req,
        })
      }
      const origin = new URL(req.url).origin
      const successPath = `/pay/${order.tableNumber}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      const cancelPath = `/pay/${order.tableNumber}?checkout=cancelled`
      const successUrl = resolveSafeRedirectUrl({
        candidate: body.successUrl,
        origin,
        fallbackPath: successPath,
      })
      const cancelUrl = resolveSafeRedirectUrl({
        candidate: body.cancelUrl,
        origin,
        fallbackPath: cancelPath,
      })

      const session = await createDirectCheckoutSessionForConnectedAccount({
        stripeAccountId: restaurant.payment.stripeAccountId,
        restaurantSlug: restaurant.slug,
        orderId: order.orderId,
        successUrl,
        cancelUrl,
        currency: order.currency,
        lineItems: order.lineItems,
        totalAmountMinor: order.totalAmountMinor,
      })

      updateOrderStripePaymentState({
        orderId: order.orderId,
        checkoutSessionId: session.checkoutSessionId,
        paymentIntentId: session.paymentIntentId,
        checkoutStatus: "PENDING",
      })

      await persistOrderStripeIds({
        orderId: order.orderId,
        restaurantSlug: restaurant.slug,
        stripeAccountId: restaurant.payment.stripeAccountId,
        checkoutSessionId: session.checkoutSessionId,
        paymentIntentId: session.paymentIntentId,
        checkoutStatus: "PENDING",
      })

      return ok(
        {
          checkoutSessionId: session.checkoutSessionId,
          checkoutUrl: session.checkoutUrl,
          paymentIntentId: session.paymentIntentId,
          applicationFeeAmountMinor: session.applicationFeeAmount,
          totalAmountMinor: order.totalAmountMinor,
        },
        undefined,
        req
      )
    } catch (error) {
      return badRequest((error as Error).message, 400, {
        code: "STRIPE_CHECKOUT_SESSION_CREATE_FAILED",
        req,
      })
    }
  })
}
