import {
  badRequest,
  ok,
  readJson,
} from "@/lib/http"
import { createStripeConnectSampleCheckoutSession } from "@/lib/stripeConnectSample"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

type Body = {
  productId?: string
  quantity?: number
}

export async function POST(req: Request) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const body = await readJson<Body>(req)
    const origin = new URL(req.url).origin

    const session = await createStripeConnectSampleCheckoutSession({
      productId: body.productId ?? "",
      quantity: Number(body.quantity ?? 1),
      origin,
    })

    return ok({ session }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_CHECKOUT_FAILED",
      req,
    })
  }
}
