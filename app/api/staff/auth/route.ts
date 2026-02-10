import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { secret } = await req.json()
  const expected = process.env.STAFF_AUTH_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json(
      { error: "INVALID_SECRET" },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set("staff_auth", expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set("staff_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
  return res
}
