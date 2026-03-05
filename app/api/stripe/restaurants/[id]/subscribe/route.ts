import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import {
  updateRestaurantSubscriptionState,
} from "@/lib/restaurants"
import {
  createConnectedAccountSetupFee,
  createConnectedAccountStripeBalanceSubscription,
  hasSetupFeePriceConfigured,
} from "@/lib/stripeConnectBilling"

export const dynamic = "force-dynamic"

type Body = {
  chargeSetupFee?: boolean
}

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)

      const requestedId = context.params.id.trim().toLowerCase()
      if (requestedId !== restaurant.slug) {
        return badRequest("Route tenant id does not match request tenant", 409, {
          code: "STRIPE_SUBSCRIPTION_TENANT_MISMATCH",
          req,
        })
      }

      if (!restaurant.payment.stripeAccountId) {
        return badRequest("Restaurant has not connected Stripe yet", 400, {
          code: "STRIPE_ACCOUNT_NOT_CONNECTED",
          req,
        })
      }

      const body = await readJson<Body>(req).catch(
        () => ({} as Body)
      )

      const subscription =
        await createConnectedAccountStripeBalanceSubscription({
          restaurantSlug: restaurant.slug,
          stripeAccountId: restaurant.payment.stripeAccountId,
        })

      await updateRestaurantSubscriptionState({
        slug: restaurant.slug,
        stripeCustomerId: restaurant.payment.stripeAccountId,
        stripeSubscriptionId: subscription.subscriptionId,
        subscriptionStatus: subscription.subscriptionStatus,
      })

      let setupFee:
        | {
            invoiceItemId: string
            invoiceId: string
            invoiceStatus: string
            hostedInvoiceUrl: string | null
          }
        | null = null

      if (body.chargeSetupFee === true) {
        if (!hasSetupFeePriceConfigured()) {
          return badRequest(
            "STRIPE_SETUP_FEE_PRICE_ID is not configured for setup fee charging",
            400,
            {
              code: "STRIPE_SETUP_FEE_NOT_CONFIGURED",
              req,
            }
          )
        }

        setupFee = await createConnectedAccountSetupFee({
          restaurantSlug: restaurant.slug,
          stripeAccountId: restaurant.payment.stripeAccountId,
        })
      }

      return ok(
        {
          subscription,
          setupFee,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400, {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "STRIPE_SUBSCRIPTION_CREATE_FAILED",
        req,
      })
    }
  })
}
