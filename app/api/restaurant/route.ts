import { requireRole } from "@/lib/auth"
import { getPaymentMode } from "@/lib/env"
import { badRequest, ok, readJson } from "@/lib/http"
import { computeLaunchReadiness } from "@/lib/launchReadiness"
import { getMenuSnapshot } from "@/lib/runtimeStore"
import type { CustomerExperienceConfig } from "@/lib/types"
import {
  getRestaurantStaffAuth,
  updateRestaurantBrandingAndExperience,
} from "@/lib/restaurants"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import {
  buildRestaurantScopedLinks,
  RESTAURANT_COOKIE_NAME,
} from "@/lib/tenant"
import { withRestaurantContext } from "@/lib/tenantContext"

export const dynamic = "force-dynamic"

type PatchBody = {
  name?: string
  location?: string | null
  logoUrl?: string | null
  heroUrl?: string | null
  experienceConfig?: CustomerExperienceConfig | null
  platformFeePercent?: number | null
  publish?: boolean
}

async function resolveLaunchReadiness(restaurant: {
  slug: string
  name: string
  location: string | null
  assets: {
    logoUrl?: string
    heroUrl?: string
  }
  experienceConfig: CustomerExperienceConfig
  isDemo: boolean
  payment: {
    stripeAccountStatus: string
    chargesEnabled: boolean
    detailsSubmitted: boolean
  }
}) {
  const { menu } = withRestaurantContext(restaurant.slug, () =>
    getMenuSnapshot({ includeInactive: true })
  )
  const staffAuth = await getRestaurantStaffAuth(restaurant.slug)
  return computeLaunchReadiness({
    restaurant,
    menu,
    staffAuth,
    paymentMode: getPaymentMode(),
  })
}

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const launchReadiness = await resolveLaunchReadiness(restaurant)
      const response = ok({
        slug: restaurant.slug,
        name: restaurant.name,
        monogram: restaurant.monogram,
        location: restaurant.location,
        assets: restaurant.assets,
        experienceConfig: restaurant.experienceConfig,
        payment: {
          ...restaurant.payment,
          platformFeePercent: Number(
            (restaurant.payment.platformFeeBps / 100).toFixed(2)
          ),
        },
        subscription: restaurant.subscription,
        isDemo: restaurant.isDemo,
        planTier: restaurant.planTier,
        billingStatus: restaurant.billingStatus,
        launchReadiness,
        links: buildRestaurantScopedLinks(restaurant.slug),
      }, undefined, req)
      response.cookies.set(RESTAURANT_COOKIE_NAME, restaurant.slug, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      })
      return response
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "RESTAURANT_READ_FAILED",
        req,
      })
    }
  })
}

export async function PATCH(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      const body = await readJson<PatchBody>(req)
      const launchOverride =
        typeof body.publish === "boolean"
          ? {
              ...(restaurant.experienceConfig.launch ?? {
                isPublished: false,
              }),
              ...(body.experienceConfig?.launch ?? {}),
              isPublished: body.publish,
            }
          : undefined

      const experienceConfig =
        launchOverride === undefined
          ? body.experienceConfig
          : {
              ...(body.experienceConfig ?? restaurant.experienceConfig),
              launch: launchOverride,
            }

      const updated = await updateRestaurantBrandingAndExperience({
        slug: restaurant.slug,
        name: body.name,
        location: body.location,
        logoUrl: body.logoUrl,
        heroUrl: body.heroUrl,
        experienceConfig,
        platformFeeBps:
          body.platformFeePercent === null ||
          body.platformFeePercent === undefined
            ? undefined
            : Math.round(Number(body.platformFeePercent) * 100),
      })
      const launchReadiness = await resolveLaunchReadiness(updated)
      if (body.publish === true && !launchReadiness.ready) {
        await updateRestaurantBrandingAndExperience({
          slug: updated.slug,
          experienceConfig: {
            ...updated.experienceConfig,
            launch: {
              ...updated.experienceConfig.launch,
              isPublished: false,
            },
          },
        })
        return badRequest(
          "Launch checklist incomplete. Complete all requirements before publishing.",
          409,
          {
            code: "LAUNCH_CHECKLIST_INCOMPLETE",
            details: launchReadiness,
            req,
          }
        )
      }
      return ok(
        {
          slug: updated.slug,
          name: updated.name,
          monogram: updated.monogram,
          location: updated.location,
          assets: updated.assets,
          experienceConfig: updated.experienceConfig,
          payment: {
            ...updated.payment,
            platformFeePercent: Number(
              (updated.payment.platformFeeBps / 100).toFixed(2)
            ),
          },
          subscription: updated.subscription,
          isDemo: updated.isDemo,
          planTier: updated.planTier,
          billingStatus: updated.billingStatus,
          launchReadiness,
          links: buildRestaurantScopedLinks(updated.slug),
        },
        undefined,
        req
      )
    } catch (error) {
      const message = (error as Error).message
      const status = message.startsWith("Unauthorized") ? 401 : 400
      return badRequest(message, status, {
        code: status === 401 ? "UNAUTHORIZED" : "RESTAURANT_UPDATE_FAILED",
        req,
      })
    }
  })
}
