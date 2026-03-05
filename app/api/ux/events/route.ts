import { badRequest, ok, readJson } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { trackUxFunnelEvent } from "@/lib/uxExperiments"

type EventBody = {
  sessionId?: string
  eventName?: string
  page?: string
  step?: string
  experimentKey?: string | null
  variantKey?: string | null
  value?: number | null
  metadata?: Record<string, unknown> | null
  occurredAt?: string
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurantSlug }) => {
    try {
      const body = await readJson<EventBody>(req)
      const event = await trackUxFunnelEvent({
        restaurantSlug,
        sessionId: body.sessionId ?? "",
        eventName: body.eventName ?? "",
        page: body.page ?? "",
        step: body.step ?? "",
        experimentKey: body.experimentKey,
        variantKey: body.variantKey,
        value: body.value,
        metadata: body.metadata ?? null,
        occurredAt: body.occurredAt,
      })
      return ok(event, undefined, req)
    } catch (error) {
      return badRequest((error as Error).message, 400, {
        code: "UX_EVENT_INGEST_FAILED",
        req,
      })
    }
  })
}