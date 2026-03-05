import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import {
  createStripeBillingCustomer,
  createStripeBillingSubscriptionCheckout,
} from "@/lib/payments"
import {
  upsertRestaurantStripeCustomer,
} from "@/lib/restaurants"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

type Body = {
  redirect?: boolean
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const body = await readJson<Body>(req).catch(() => ({} as Body))

      if (
        restaurant.subscription.active &&
        restaurant.subscription.stripeSubscriptionId
      ) {
        return ok(
          {
            active: true,
            subscriptionStatus: restaurant.subscription.status,
            stripeCustomerId: restaurant.subscription.stripeCustomerId,
            stripeSubscriptionId: restaurant.subscription.stripeSubscriptionId,
          },
          undefined,
          req
        )
      }

      let stripeCustomerId = restaurant.subscription.stripeCustomerId
      if (!stripeCustomerId) {
        const customer = await createStripeBillingCustomer({
          restaurant,
        })
        stripeCustomerId = customer.stripeCustomerId
        await upsertRestaurantStripeCustomer({
          slug: restaurant.slug,
          stripeCustomerId,
        })
      }

      const origin = new URL(req.url).origin
      const result = await createStripeBillingSubscriptionCheckout({
        restaurant,
        stripeCustomerId,
        successUrl: `${origin}/r/${restaurant.slug}?next=/admin&billing=success`,
        cancelUrl: `${origin}/r/${restaurant.slug}?next=/admin&billing=cancelled`,
      })

      if (body.redirect) {
        return Response.redirect(result.checkoutUrl, 303)
      }

      return ok(
        {
          checkoutUrl: result.checkoutUrl,
          checkoutSessionId: result.checkoutSessionId,
          stripeCustomerId,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(
        message,
        message.startsWith("Unauthorized") ? 401 : 400,
        {
          code: message.startsWith("Unauthorized")
            ? "UNAUTHORIZED"
            : "STRIPE_BILLING_SUBSCRIBE_FAILED",
          req,
        }
      )
    }
  })
}
