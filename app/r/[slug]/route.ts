import { NextResponse } from "next/server"
import { badRequest } from "@/lib/http"
import { requireRestaurantForSlug } from "@/lib/restaurants"
import { RESTAURANT_COOKIE_NAME } from "@/lib/tenant"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    slug: string
  }
}

function sanitizeNextPath(value: string | null) {
  if (!value) return "/menu"
  if (!value.startsWith("/")) return "/menu"
  if (value.startsWith("//")) return "/menu"
  return value
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const requestedSlug = context.params.slug
    const restaurant = await requireRestaurantForSlug(requestedSlug)
    const url = new URL(req.url)
    const destination = sanitizeNextPath(url.searchParams.get("next"))
    const target = new URL(destination, url.origin)

    const response = NextResponse.redirect(target)
    response.cookies.set(RESTAURANT_COOKIE_NAME, restaurant.slug, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (error) {
    return badRequest((error as Error).message, 404, {
      code: "RESTAURANT_NOT_FOUND",
      req,
    })
  }
}
