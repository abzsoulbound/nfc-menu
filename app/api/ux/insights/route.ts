import { requireRole } from "@/lib/auth"
import { badRequest, ok } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { getUxInsights } from "@/lib/uxExperiments"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const url = new URL(req.url)
      const experimentKey = url.searchParams.get("experimentKey")?.trim() ?? ""
      if (!experimentKey) {
        return badRequest("experimentKey is required", 400, {
          code: "UX_INSIGHTS_EXPERIMENT_REQUIRED",
          req,
        })
      }

      const daysRaw = Number(url.searchParams.get("days") ?? "14")
      const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14
      const until = new Date()
      const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000)

      const insights = await getUxInsights({
        restaurantSlug,
        experimentKey,
        since,
        until,
      })
      return ok(insights, undefined, req)
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "UX_INSIGHTS_FETCH_FAILED",
        req,
      })
    }
  })
}