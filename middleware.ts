import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const staffSecret = process.env.STAFF_AUTH_SECRET

  if (path.startsWith("/staff/login")) {
    return NextResponse.next()
  }

  if (
    path.startsWith("/staff") ||
    path.startsWith("/kitchen") ||
    path.startsWith("/bar")
  ) {
    const headerToken = req.headers.get("x-staff-auth")
    const cookieToken = req.cookies.get("staff_auth")?.value
    const valid =
      !!staffSecret &&
      (headerToken === staffSecret || cookieToken === staffSecret)

    if (!valid) {
      return NextResponse.redirect(new URL("/staff/login", req.url))
    }

    const res = NextResponse.next()
    if (headerToken === staffSecret && cookieToken !== staffSecret) {
      res.cookies.set("staff_auth", staffSecret, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      })
    }
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/staff/:path*", "/kitchen/:path*", "/bar/:path*"],
}
