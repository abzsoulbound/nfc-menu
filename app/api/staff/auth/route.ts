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

function setAuthorizedCookies(res: NextResponse) {
  const authToken = process.env.STAFF_AUTH_SECRET
  if (!authToken) return
  res.cookies.set(staffAuthCookies.auth, authToken, cookieBase)
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
  res.cookies.set(staffAuthCookies.failures, "0", cookieBase)
  res.cookies.set(staffAuthCookies.locked, "", {
    ...cookieBase,
    expires: new Date(0),
  })
}

function validateRoleAuth(role: StaffRole, passcode: string) {
  const expected = getRolePasscode(role)
  return !!expected && passcode === expected
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
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${staffAuthCookies.auth}=`))
    ?.split("=")[1]
  const authorized =
    !!token &&
    !!process.env.STAFF_AUTH_SECRET &&
    decodeURIComponent(token) === process.env.STAFF_AUTH_SECRET

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
  setAuthorizedCookies(res)

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  clearAuthCookies(res)
  return res
}
