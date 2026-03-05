import { NextResponse } from "next/server"
import { badRequest } from "@/lib/http"
import {
  exchangeStripeConnectCode,
  fetchStripeConnectedAccount,
  verifyStripeConnectState,
} from "@/lib/payments"
import { updateRestaurantStripeConnection } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const state = url.searchParams.get("state")?.trim() ?? ""
    const code = url.searchParams.get("code")?.trim() ?? ""
    const error = url.searchParams.get("error")?.trim() ?? ""

    if (!state) {
      return badRequest("state is required", 400, {
        code: "STRIPE_CONNECT_STATE_REQUIRED",
        req,
      })
    }

    const verified = verifyStripeConnectState(state)
    const adminUrl = new URL(
      `/r/${verified.restaurantSlug}?next=/admin`,
      url.origin
    )

    if (error) {
      adminUrl.searchParams.set("stripe", "failed")
      adminUrl.searchParams.set(
        "reason",
        url.searchParams.get("error_description")?.trim() ?? error
      )
      return NextResponse.redirect(adminUrl)
    }

    if (!code) {
      return badRequest("code is required", 400, {
        code: "STRIPE_CONNECT_CODE_REQUIRED",
        req,
      })
    }

    const token = await exchangeStripeConnectCode({ code })
    const account = await fetchStripeConnectedAccount({
      stripeAccountId: token.stripeAccountId,
    })

    await updateRestaurantStripeConnection({
      slug: verified.restaurantSlug,
      stripeAccountId: account.stripeAccountId,
      stripeAccountStatus: account.status,
      stripeChargesEnabled: account.chargesEnabled,
      stripePayoutsEnabled: account.payoutsEnabled,
      stripeDetailsSubmitted: account.detailsSubmitted,
    })

    adminUrl.searchParams.set("stripe", "connected")
    return NextResponse.redirect(adminUrl)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_CONNECT_CALLBACK_FAILED",
      req,
    })
  }
}
