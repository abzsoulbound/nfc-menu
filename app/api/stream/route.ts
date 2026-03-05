import { createRuntimeEventStream } from "@/lib/realtime"
import { badRequest } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { hydrateRuntimeStateFromDb } from "@/lib/runtimePersistence"
import { getSessionById } from "@/lib/runtimeStore"

export const dynamic = "force-dynamic"

function hasStaffStreamAccess(req: Request) {
  try {
    requireRole(["WAITER", "BAR", "KITCHEN", "MANAGER", "ADMIN"], req)
    return true
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(
    req,
    async ({ restaurantSlug, restaurant }) => {
      await hydrateRuntimeStateFromDb()
      if (restaurant.isDemo) {
        const stream = createRuntimeEventStream(restaurantSlug)
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        })
      }
      const url = new URL(req.url)
      const sessionId = url.searchParams.get("sessionId")?.trim() ?? ""
      const hasStaffAccess = hasStaffStreamAccess(req)

      if (!hasStaffAccess) {
        if (!sessionId || !getSessionById(sessionId)) {
          return badRequest("Unauthorized: stream access denied", 401, {
            code: "UNAUTHORIZED",
            req,
          })
        }
      }

      const stream = createRuntimeEventStream(restaurantSlug)
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      })
    }
  )
}
