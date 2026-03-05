import {
  badRequest,
  ok,
  readJson,
} from "@/lib/http"
import {
  createStripeConnectSampleSeller,
  listStripeConnectSampleSellers,
} from "@/lib/stripeConnectSample"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

type CreateBody = {
  displayName?: string
  contactEmail?: string
}

export async function GET(req: Request) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const sellers = await listStripeConnectSampleSellers()
    return ok({ sellers }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_ACCOUNTS_LIST_FAILED",
      req,
    })
  }
}

export async function POST(req: Request) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const body = await readJson<CreateBody>(req)
    const seller = await createStripeConnectSampleSeller({
      displayName: body.displayName ?? "",
      contactEmail: body.contactEmail ?? "",
    })

    return ok({ seller }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_ACCOUNTS_CREATE_FAILED",
      req,
    })
  }
}
