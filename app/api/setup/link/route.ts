import { badRequest, ok, readJson } from "@/lib/http"
import { requireSystem } from "@/lib/auth"
import { createRestaurantSetupToken } from "@/lib/restaurants"
import type { SetupBootstrapPayload } from "@/lib/types"
import { isSetupV2Enabled } from "@/lib/env"

type Body = {
  expiresInHours?: number
  createdBy?: string | null
  bootstrap?: SetupBootstrapPayload | null
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    if (!isSetupV2Enabled()) {
      return badRequest("Setup v2 is disabled", 403, {
        code: "SETUP_V2_DISABLED",
        req,
      })
    }
    requireSystem(req)

    let body: Body = {}
    try {
      body = await readJson<Body>(req)
    } catch {
      body = {}
    }

    const issued = await createRestaurantSetupToken({
      expiresInHours: body.expiresInHours,
      createdBy: body.createdBy,
      bootstrap: body.bootstrap ?? null,
    })
    const origin = new URL(req.url).origin
    return ok({
      setupLink: `${origin}/setup/${issued.token}`,
      setupStatusUrl: `${origin}/api/setup/status/${issued.token}`,
      token: issued.token,
      expiresAt: issued.expiresAt,
    }, undefined, req)
  } catch (error) {
    const message = (error as Error).message
    return badRequest(
      message,
      message.startsWith("Unauthorized") ? 401 : 400,
      {
        code: message.startsWith("Unauthorized")
          ? "UNAUTHORIZED"
          : "SETUP_LINK_CREATE_FAILED",
        req,
      }
    )
  }
}
