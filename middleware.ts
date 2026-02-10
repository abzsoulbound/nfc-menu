import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (
    path.startsWith("/staff") ||
    path.startsWith("/kitchen") ||
    path.startsWith("/bar")
  ) {
    const staff = req.headers.get("x-staff-auth")
    if (!staff) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/staff/:path*", "/kitchen/:path*", "/bar/:path*"],
}