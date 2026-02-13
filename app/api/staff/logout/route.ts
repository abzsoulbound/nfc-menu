import { requireRestaurantContext } from "@/lib/db/tenant"
import { withRequestId } from "@/lib/apiResponse"
import { prisma } from "@/lib/prisma"
import { STAFF_SESSION_COOKIE } from "@/lib/staffAuth"
import { hashSessionToken } from "@/lib/staffSessions"

function readCookie(req: Request, key: string) {
  const raw = req.headers.get("cookie")
  if (!raw) return null

  const prefix = `${key}=`
  const part = raw
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(prefix))

  if (!part) return null
  try {
    return decodeURIComponent(part.slice(prefix.length))
  } catch {
    return part.slice(prefix.length)
  }
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID()

  let context
  try {
    context = requireRestaurantContext(req.headers)
  } catch {
    return withRequestId(
      { error: "TENANT_CONTEXT_MISSING", requestId },
      { status: 500 },
      requestId
    )
  }

  const rawToken = readCookie(req, STAFF_SESSION_COOKIE)
  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken)
    await prisma.staffSession.updateMany({
      where: {
        tokenHash,
        restaurantId: context.restaurantId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  const response = withRequestId(
    { ok: true, requestId },
    { status: 200 },
    requestId
  )

  response.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  })

  return response
}
