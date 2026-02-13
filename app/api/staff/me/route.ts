import { requireRestaurantContext } from "@/lib/db/tenant"
import { withRequestId } from "@/lib/apiResponse"
import { requireStaffSession } from "@/lib/auth"

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID()

  try {
    requireRestaurantContext(req.headers)
  } catch {
    return withRequestId(
      { error: "TENANT_CONTEXT_MISSING", requestId },
      { status: 500 },
      requestId
    )
  }

  try {
    const staff = await requireStaffSession(req)
    return withRequestId(
      {
        ok: true,
        requestId,
        staff: {
          id: staff.staffUserId,
          role: staff.role,
          restaurantId: staff.restaurantId,
          restaurantSlug: staff.restaurantSlug,
        },
      },
      { status: 200 },
      requestId
    )
  } catch {
    return withRequestId(
      { error: "UNAUTHORIZED", requestId },
      { status: 401 },
      requestId
    )
  }
}
