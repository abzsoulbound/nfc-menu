import { badRequest, ok, readJson } from "@/lib/http"
import { completeRestaurantSetup } from "@/lib/restaurants"
import { RESTAURANT_COOKIE_NAME } from "@/lib/tenant"
import type { OnboardingResult } from "@/lib/types"
import { isSetupV2Enabled } from "@/lib/env"

type Body = {
  token?: string
  name?: string
  slug?: string | null
  location?: string | null
  logoUrl?: string | null
  heroUrl?: string | null
  planTier?: string | null
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    if (!isSetupV2Enabled()) {
      return badRequest("Setup v2 is disabled", 403, {
        code: "SETUP_V2_DISABLED",
        req,
      })
    }
    const body = await readJson<Body>(req)
    const token = body.token?.trim() ?? ""
    const name = body.name?.trim() ?? ""
    if (!token) {
      return badRequest("token is required", 400, {
        code: "SETUP_TOKEN_REQUIRED",
        req,
      })
    }
    if (!name) {
      return badRequest("name is required", 400, {
        code: "SETUP_NAME_REQUIRED",
        req,
      })
    }

    const result = await completeRestaurantSetup({
      token,
      name,
      slug: body.slug,
      location: body.location,
      logoUrl: body.logoUrl,
      heroUrl: body.heroUrl,
      planTier: body.planTier,
    })
    const launchUrl = `/r/${result.restaurant.slug}?next=/menu`
    const staffLoginUrl = `/r/${result.restaurant.slug}?next=/staff-login`
    const managerUrl = `/r/${result.restaurant.slug}?next=/manager`
    const managerCustomizeUrl = `/r/${result.restaurant.slug}?next=/manager/customize`
    const adminUrl = `/r/${result.restaurant.slug}?next=/admin`

    const payload: OnboardingResult & {
      // Backward-compatible fields for existing setup UI.
      passcodes: Record<"WAITER" | "BAR" | "KITCHEN" | "MANAGER" | "ADMIN", string[]>
    } = {
      restaurant: {
        slug: result.restaurant.slug,
        name: result.restaurant.name,
        monogram: result.restaurant.monogram,
        location: result.restaurant.location,
        isDemo: result.restaurant.isDemo,
        planTier: result.restaurant.planTier,
        billingStatus: result.restaurant.billingStatus,
      },
      launchUrl,
      staffLoginUrl,
      initialCredentials: {
        passcodes: result.staffAuth,
      },
      checklist: result.checklist,
      nextActions: [
        { label: "Open Customer Menu", href: launchUrl, role: "CUSTOMER" },
        { label: "Open Staff Login", href: staffLoginUrl, role: "WAITER" },
        { label: "Open Manager", href: managerUrl, role: "MANAGER" },
        { label: "Customize Customer Pages", href: managerCustomizeUrl, role: "MANAGER" },
        { label: "Open Admin", href: adminUrl, role: "ADMIN" },
      ],
      passcodes: result.staffAuth,
    }

    const response = ok(payload, undefined, req)
    response.cookies.set(RESTAURANT_COOKIE_NAME, result.restaurant.slug, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "SETUP_COMPLETE_FAILED",
      req,
    })
  }
}
