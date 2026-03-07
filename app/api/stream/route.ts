import { createRuntimeEventStream } from "@/lib/realtime"
import { badRequest } from "@/lib/http"
import { requireRole } from "@/lib/auth"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { hydrateRuntimeStateFromDb } from "@/lib/runtimePersistence"

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
      const hasStaffAccess = hasStaffStreamAccess(req)

      // Demo tenants intentionally expose open streams for fast operator demos.
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

      if (!hasStaffAccess) {
        return badRequest("Unauthorized: stream access denied", 401, {
          code: "UNAUTHORIZED",
          req,
        })
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
