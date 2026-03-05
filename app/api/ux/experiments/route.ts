import { requireRole } from "@/lib/auth"
import { badRequest, ok, readJson } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { listUxExperiments, upsertUxExperiment } from "@/lib/uxExperiments"
import type { UxExperimentStatus } from "@/lib/types"

export const dynamic = "force-dynamic"

type UpsertBody = {
  key?: string
  name?: string
  description?: string | null
  status?: UxExperimentStatus
  trafficPercent?: number
  variants?: unknown
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const url = new URL(req.url)
      const status = url.searchParams.get("status")
      const experiments = await listUxExperiments({
        restaurantSlug,
        status:
          status === "DRAFT" ||
          status === "LIVE" ||
          status === "PAUSED" ||
          status === "ARCHIVED"
            ? status
            : undefined,
      })
      return ok(experiments, undefined, req)
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "UX_EXPERIMENTS_FETCH_FAILED",
        req,
      })
    }
  })
}

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const body = await readJson<UpsertBody>(req)
      const experiment = await upsertUxExperiment({
        restaurantSlug,
        key: body.key ?? "",
        name: body.name ?? "",
        description: body.description ?? null,
        status: body.status ?? "DRAFT",
        trafficPercent: Number(body.trafficPercent ?? 100),
        variants: body.variants,
      })
      return ok(experiment, undefined, req)
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "UX_EXPERIMENTS_UPSERT_FAILED",
        req,
      })
    }
  })
}