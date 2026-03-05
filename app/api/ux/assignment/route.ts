import { badRequest, ok, readJson } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { assignUxExperiment } from "@/lib/uxExperiments"

type AssignmentBody = {
  sessionId?: string
  experimentKey?: string
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    try {
      const body = await readJson<AssignmentBody>(req)
      const payload = await assignUxExperiment({
        restaurantSlug,
        sessionId: body.sessionId ?? "",
        experimentKey: body.experimentKey ?? "",
      })
      return ok(payload, undefined, req)
    } catch (error) {
      return badRequest((error as Error).message, 400, {
        code: "UX_ASSIGNMENT_FAILED",
        req,
      })
    }
  })
}