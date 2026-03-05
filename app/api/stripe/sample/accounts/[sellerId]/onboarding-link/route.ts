import {
  badRequest,
  ok,
} from "@/lib/http"
import { createStripeConnectSampleOnboardingLink } from "@/lib/stripeConnectSample"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  context: {
    params: {
      sellerId: string
    }
  }
) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const origin = new URL(req.url).origin
    const link = await createStripeConnectSampleOnboardingLink({
      sellerId: context.params.sellerId,
      origin,
    })

    return ok({ link }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_ACCOUNT_LINK_FAILED",
      req,
    })
  }
}
