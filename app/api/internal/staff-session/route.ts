import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashSessionToken } from "@/lib/staffSessions"
import { STAFF_SESSION_COOKIE } from "@/lib/staffAuth"

function readCookie(rawCookie: string | null, key: string) {
  if (!rawCookie) return null
  const prefix = `${key}=`
  const part = rawCookie
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

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (req.headers.get("x-internal-staff-check") !== "1") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const restaurantId = req.headers.get("x-restaurant-id")?.trim()
  if (!restaurantId) {
    return NextResponse.json({ authorized: false })
  }

  const rawToken = readCookie(req.headers.get("cookie"), STAFF_SESSION_COOKIE)
  if (!rawToken) {
    return NextResponse.json({ authorized: false })
  }

  const tokenHash = hashSessionToken(rawToken)
  const session = await prisma.staffSession.findFirst({
    where: {
      restaurantId,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      staffUser: {
        active: true,
        restaurantId,
      },
    },
    include: {
      staffUser: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ authorized: false })
  }

  const url = new URL(req.url)
  const roles = (url.searchParams.get("roles") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)

  const role = session.staffUser.role ?? ""
  const roleAllowed = roles.length === 0 || roles.includes(role)

  return NextResponse.json({
    authorized: roleAllowed,
    staffUserId: session.staffUser.id,
    role,
    restaurantId,
  })
}
