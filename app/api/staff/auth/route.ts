import { NextResponse } from "next/server"
import {
  getManagerPasscode,
  getRolePasscode,
  isStaffRole,
  staffAuthCookies,
  type StaffRole,
} from "@/lib/staffAuth"

const MAX_FAILED_ATTEMPTS = 3
const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

function readFailures(req: Request) {
  const raw = req.headers.get("cookie")
  if (!raw) return 0
  const key = `${staffAuthCookies.failures}=`
  const value = raw
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(key))
  if (!value) return 0
  const parsed = Number(value.slice(key.length))
  return Number.isFinite(parsed) ? parsed : 0
}

function isLocked(req: Request) {
  const raw = req.headers.get("cookie")
  if (!raw) return false
  const key = `${staffAuthCookies.locked}=1`
  return raw
    .split(";")
    .map(part => part.trim())
    .includes(key)
}

function readCookie(req: Request, key: string) {
  const raw = req.headers.get("cookie")
  if (!raw) return null
  const prefix = `${key}=`
  const token = raw
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
  if (!token) return null
  return decodeURIComponent(token.slice(prefix.length))
}

function setAuthorizedCookies(
  res: NextResponse,
  role: StaffRole
) {
  const authToken = process.env.STAFF_AUTH_SECRET
  if (!authToken) return
  res.cookies.set(staffAuthCookies.auth, authToken, cookieBase)
  res.cookies.set(staffAuthCookies.role, role, cookieBase)
  res.cookies.set(staffAuthCookies.failures, "0", cookieBase)
  res.cookies.set(staffAuthCookies.locked, "", {
    ...cookieBase,
    expires: new Date(0),
  })
}

function setFailureCookies(res: NextResponse, failedAttempts: number) {
  const locked = failedAttempts >= MAX_FAILED_ATTEMPTS
  res.cookies.set(staffAuthCookies.failures, String(failedAttempts), cookieBase)
  if (locked) {
    res.cookies.set(staffAuthCookies.locked, "1", cookieBase)
  }
}

function clearAuthCookies(res: NextResponse) {
  res.cookies.set(staffAuthCookies.auth, "", {
    ...cookieBase,
    expires: new Date(0),
  })
  res.cookies.set(staffAuthCookies.role, "", {
    ...cookieBase,
    expires: new Date(0),
  })
  res.cookies.set(staffAuthCookies.failures, "0", cookieBase)
  res.cookies.set(staffAuthCookies.locked, "", {
    ...cookieBase,
    expires: new Date(0),
  })
}

function validateRoleAuth(role: StaffRole, passcode: string) {
  const expected = getRolePasscode(role)
  if (expected && passcode === expected) return true

  // Allow manager passcode to authenticate admin screens directly.
  if (role === "admin") {
    const managerPasscode = getManagerPasscode()
    return !!managerPasscode && passcode === managerPasscode
  }

  return false
}

function validateManagerUnlock(passcode: string) {
  const expected = getManagerPasscode()
  return !!expected && passcode === expected
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role")

  if (!role || !isStaffRole(role)) {
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 })
  }

  const locked = isLocked(req)
  const failures = readFailures(req)
  const token = readCookie(req, staffAuthCookies.auth)
  const sessionRole = readCookie(req, staffAuthCookies.role)
  const authorized =
    !!token &&
    !!sessionRole &&
    !!process.env.STAFF_AUTH_SECRET &&
    token === process.env.STAFF_AUTH_SECRET &&
    sessionRole === role

  return NextResponse.json({
    authorized,
    locked,
    failures,
    remaining: Math.max(0, MAX_FAILED_ATTEMPTS - failures),
  })
}

export async function POST(req: Request) {
  const body = await req.json()

  if (body?.action === "unlock") {
    const managerPasscode = String(body?.managerPasscode ?? "")
    if (!validateManagerUnlock(managerPasscode)) {
      return NextResponse.json({ error: "INVALID_MANAGER_PASSCODE" }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, unlocked: true })
    res.cookies.set(staffAuthCookies.failures, "0", cookieBase)
    res.cookies.set(staffAuthCookies.locked, "", {
      ...cookieBase,
      expires: new Date(0),
    })
    return res
  }

  const role = body?.role
  const passcode = String(body?.passcode ?? "")

  if (!role || !isStaffRole(role)) {
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 })
  }

  if (isLocked(req)) {
    return NextResponse.json(
      {
        error: "LOCKED",
        remaining: 0,
        locked: true,
      },
      { status: 423 }
    )
  }

  if (!validateRoleAuth(role, passcode)) {
    const failedAttempts = readFailures(req) + 1
    const res = NextResponse.json(
      {
        error: "INVALID_PASSCODE",
        remaining: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
        locked: failedAttempts >= MAX_FAILED_ATTEMPTS,
      },
      { status: 401 }
    )
    setFailureCookies(res, failedAttempts)
    return res
  }

  const res = NextResponse.json({ ok: true })
  setAuthorizedCookies(res, role)

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  clearAuthCookies(res)
  return res
}
