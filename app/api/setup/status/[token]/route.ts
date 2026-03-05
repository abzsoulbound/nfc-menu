import { badRequest, ok } from "@/lib/http"
import { getRestaurantSetupStatus } from "@/lib/restaurants"
import { isSetupV2Enabled } from "@/lib/env"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  context: { params: { token: string } }
) {
  try {
    if (!isSetupV2Enabled()) {
      return badRequest("Setup v2 is disabled", 403, {
        code: "SETUP_V2_DISABLED",
        req,
      })
    }
    const token = context.params.token ?? ""
    const status = await getRestaurantSetupStatus(token)
    return ok(status, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "SETUP_STATUS_FAILED",
      req,
    })
  }
}
