import {
  badRequest,
  ok,
} from "@/lib/http"
import { handleStripeConnectSampleWebhook } from "@/lib/stripeConnectSample"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const payload = await req.text()
    const result = await handleStripeConnectSampleWebhook({
      payload,
      signatureHeader: req.headers.get("stripe-signature"),
    })

    return ok(result, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_WEBHOOK_FAILED",
      req,
    })
  }
}
