import {
  badRequest,
  ok,
  readJson,
} from "@/lib/http"
import {
  createStripeConnectSampleProduct,
  listStripeConnectSampleProducts,
} from "@/lib/stripeConnectSample"
import { isDemoToolsEnabled } from "@/lib/env"

export const dynamic = "force-dynamic"

type CreateBody = {
  sellerId?: string
  name?: string
  description?: string | null
  priceInCents?: number
  currency?: string
}

export async function GET(req: Request) {
  if (!isDemoToolsEnabled()) {
    return badRequest("Demo tools are disabled", 404, {
      code: "DEMO_TOOLS_DISABLED",
      req,
    })
  }
  try {
    const products = await listStripeConnectSampleProducts()
    return ok({ products }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_PRODUCTS_LIST_FAILED",
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
    const product = await createStripeConnectSampleProduct({
      sellerId: body.sellerId ?? "",
      name: body.name ?? "",
      description: body.description ?? null,
      priceInCents: Number(body.priceInCents ?? 0),
      currency: body.currency,
    })

    return ok({ product }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_SAMPLE_PRODUCTS_CREATE_FAILED",
      req,
    })
  }
}
