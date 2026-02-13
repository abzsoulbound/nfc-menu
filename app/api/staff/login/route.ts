import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRestaurantContext } from "@/lib/db/tenant"
import { withRequestId } from "@/lib/apiResponse"
import { STAFF_SESSION_COOKIE, isStaffRole } from "@/lib/staffAuth"
import {
  createSessionToken,
  getSessionTtlMs,
  hashPasscode,
  hashSessionToken,
  normalizeIdentifier,
  requestIpAddress,
  requestUserAgent,
  verifyPasscode,
} from "@/lib/staffSessions"

const MAX_WINDOW_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BASE_BACKOFF_MS = 30 * 1000
const MAX_BACKOFF_MS = 30 * 60 * 1000

const ROLE_PASSCODE_ENV: Record<"admin" | "waiter" | "bar" | "kitchen", string> = {
  admin: "ADMIN_PASSCODE",
  waiter: "WAITER_PASSCODE",
  bar: "BAR_PASSCODE",
  kitchen: "KITCHEN_PASSCODE",
}

function parseBody(body: unknown) {
  const payload =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {}

  const role = typeof payload.role === "string" ? payload.role : ""
  const passcode =
    typeof payload.passcode === "string" ? payload.passcode : ""
  const identifier = normalizeIdentifier(payload.identifier ?? role)
  const deviceLabel =
    typeof payload.deviceLabel === "string" && payload.deviceLabel.trim().length > 0
      ? payload.deviceLabel.trim().slice(0, 120)
      : null

  return {
    role,
    passcode,
    identifier,
    deviceLabel,
  }
}

async function recordAttempt(input: {
  restaurantId: string
  identifier: string
  ip: string
  success: boolean
}) {
  await prisma.staffLoginAttempt.create({
    data: {
      restaurantId: input.restaurantId,
      identifier: input.identifier,
      ip: input.ip,
      success: input.success,
    },
  })
}

async function getThrottleState(input: {
  restaurantId: string
  identifier: string
  ip: string
}) {
  const windowStart = new Date(Date.now() - WINDOW_MS)

  const failedAttempts = await prisma.staffLoginAttempt.findMany({
    where: {
      restaurantId: input.restaurantId,
      identifier: input.identifier,
      ip: input.ip,
      success: false,
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    select: {
      createdAt: true,
    },
  })

  if (failedAttempts.length < MAX_WINDOW_FAILED_ATTEMPTS) {
    return {
      throttled: false,
      retryAfterMs: 0,
      failedAttempts: failedAttempts.length,
    }
  }

  const mostRecentFailure = failedAttempts[0]?.createdAt
  if (!mostRecentFailure) {
    return {
      throttled: false,
      retryAfterMs: 0,
      failedAttempts: failedAttempts.length,
    }
  }

  const multiplier = Math.max(0, failedAttempts.length - MAX_WINDOW_FAILED_ATTEMPTS)
  const backoffMs = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * Math.pow(2, multiplier)
  )
  const retryAt = mostRecentFailure.getTime() + backoffMs
  const retryAfterMs = retryAt - Date.now()

  return {
    throttled: retryAfterMs > 0,
    retryAfterMs: Math.max(0, retryAfterMs),
    failedAttempts: failedAttempts.length,
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return withRequestId(
      { error: "BAD_REQUEST", requestId },
      { status: 400 },
      requestId
    )
  }

  const payload = parseBody(body)

  if (!isStaffRole(payload.role) || !payload.passcode.trim() || !payload.identifier) {
    return withRequestId(
      { error: "BAD_REQUEST", requestId },
      { status: 400 },
      requestId
    )
  }

  const ip = requestIpAddress(req)
  const throttle = await getThrottleState({
    restaurantId: context.restaurantId,
    identifier: payload.identifier,
    ip,
  })

  if (throttle.throttled) {
    return withRequestId(
      {
        error: "THROTTLED",
        retryAfterMs: throttle.retryAfterMs,
        requestId,
      },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(throttle.retryAfterMs / 1000)),
        },
      },
      requestId
    )
  }

  const staffUser = await prisma.staffUser.findFirst({
    where: {
      restaurantId: context.restaurantId,
      role: payload.role,
      active: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  let passcodeHash = staffUser?.passcodeHash ?? null
  if (staffUser && !passcodeHash) {
    const fallbackEnvKey = ROLE_PASSCODE_ENV[payload.role]
    const fallbackPasscode = process.env[fallbackEnvKey]?.trim()
    if (fallbackPasscode && payload.passcode === fallbackPasscode) {
      passcodeHash = await hashPasscode(payload.passcode)
      await prisma.staffUser.update({
        where: { id: staffUser.id },
        data: {
          passcodeHash,
          passcodeUpdatedAt: new Date(),
        },
      })
    }
  }

  const verified = staffUser
    ? await verifyPasscode(payload.passcode, passcodeHash)
    : false

  if (!staffUser || !verified) {
    await recordAttempt({
      restaurantId: context.restaurantId,
      identifier: payload.identifier,
      ip,
      success: false,
    })

    const nextThrottle = await getThrottleState({
      restaurantId: context.restaurantId,
      identifier: payload.identifier,
      ip,
    })

    if (nextThrottle.throttled) {
      return withRequestId(
        {
          error: "THROTTLED",
          retryAfterMs: nextThrottle.retryAfterMs,
          requestId,
        },
        {
          status: 429,
          headers: {
            "retry-after": String(
              Math.ceil(nextThrottle.retryAfterMs / 1000)
            ),
          },
        },
        requestId
      )
    }

    return withRequestId(
      { error: "INVALID_CREDENTIALS", requestId },
      { status: 401 },
      requestId
    )
  }

  await recordAttempt({
    restaurantId: context.restaurantId,
    identifier: payload.identifier,
    ip,
    success: true,
  })

  const rawToken = createSessionToken()
  const tokenHash = hashSessionToken(rawToken)
  const expiresAt = new Date(Date.now() + getSessionTtlMs())

  const session = await prisma.staffSession.create({
    data: {
      restaurantId: context.restaurantId,
      staffUserId: staffUser.id,
      tokenHash,
      expiresAt,
      ip,
      userAgent: requestUserAgent(req),
      deviceLabel: payload.deviceLabel,
    },
  })

  const response = withRequestId(
    {
      ok: true,
      requestId,
      staff: {
        id: staffUser.id,
        name: staffUser.name,
        role: staffUser.role,
        restaurantId: context.restaurantId,
      },
    },
    { status: 200 },
    requestId
  )

  response.cookies.set(STAFF_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
  response.headers.set("x-staff-session-id", session.id)

  return response
}
