import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { badRequest, ok } from "@/lib/http"
import { createStripeConnectAuthorizeUrl } from "@/lib/payments"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      const actor = requireRole(["MANAGER", "ADMIN"], req)
      const { url } = createStripeConnectAuthorizeUrl({
        restaurantSlug: restaurant.slug,
        actorId: actor.id,
      })

      const shouldRedirect =
        new URL(req.url).searchParams.get("redirect") === "1"
      if (shouldRedirect) {
        return NextResponse.redirect(url)
      }

      return ok(
        {
          connectUrl: url,
          provider: "STRIPE_CONNECT_STANDARD",
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400, {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "STRIPE_CONNECT_START_FAILED",
        req,
      })
    }
  })
}
