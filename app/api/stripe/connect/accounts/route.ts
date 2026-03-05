import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import {
  createConnectedAccountWithOnboardingLink,
} from "@/lib/stripeConnectBilling"
import { updateRestaurantStripeConnection } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

type Body = {
  contactEmail?: string
  country?: string
  phone?: string
  refreshUrl?: string
  returnUrl?: string
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const body = await readJson<Body>(req).catch(
        () => ({} as Body)
      )

      const origin = new URL(req.url).origin
      const refreshUrl =
        body.refreshUrl?.trim() ||
        `${origin}/r/${restaurant.slug}?next=/admin&stripe=reauth`
      const returnUrl =
        body.returnUrl?.trim() ||
        `${origin}/r/${restaurant.slug}?next=/admin&stripe=connected`

      const account = await createConnectedAccountWithOnboardingLink({
        restaurantDisplayName: restaurant.name,
        contactEmail:
          body.contactEmail?.trim() ||
          process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
          `${restaurant.slug}@example.com`,
        country: body.country,
        phone: body.phone,
        refreshUrl,
        returnUrl,
      })

      await updateRestaurantStripeConnection({
        slug: restaurant.slug,
        stripeAccountId: account.accountId,
        stripeAccountStatus: "PENDING",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
      })

      return ok(
        {
          accountId: account.accountId,
          onboardingUrl: account.onboardingUrl,
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400, {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "STRIPE_CONNECT_ACCOUNT_CREATE_FAILED",
        req,
      })
    }
  })
}
