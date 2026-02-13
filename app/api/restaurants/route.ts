import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaffRole } from "@/lib/auth"
import {
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_SLUG,
} from "@/lib/restaurantConstants"
import {
  externalOrderUrl,
  getBrandingConfig,
  normalizeDomain,
} from "@/lib/restaurants"
import { ensureCanonicalMenu } from "@/lib/menuCatalog"
import { hashPasscode } from "@/lib/staffSessions"

function normalizeSlug(value: unknown) {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBaseUrl(domain: string | null) {
  const normalized = normalizeDomain(domain)
  if (!normalized) return null
  return `https://${normalized}`
}

function restaurantIdFromSlug(slug: string) {
  if (slug === DEFAULT_RESTAURANT_SLUG) {
    return DEFAULT_RESTAURANT_ID
  }
  return `rest_${slug}_${crypto.randomUUID().slice(0, 8)}`
}

async function requireAdmin(req: Request) {
  return requireStaffRole(req, ["admin"])
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          menuItems: true,
          tableAssignments: true,
          staffUsers: true,
        },
      },
    },
  })

  return NextResponse.json({
    restaurants: restaurants.map(restaurant => ({
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      primaryColor: restaurant.primaryColor,
      secondaryColor: restaurant.secondaryColor,
      domain: restaurant.domain,
      vatRate: restaurant.vatRate,
      serviceCharge: restaurant.serviceCharge,
      createdAt: restaurant.createdAt,
      stats: restaurant._count,
    })),
  })
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const body = await req.json()
  const slug = normalizeSlug(body?.slug)
  const name =
    typeof body?.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : ""

  if (!slug || !name) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const branding = getBrandingConfig({
    name,
    logoUrl: typeof body?.logoUrl === "string" ? body.logoUrl : null,
    primaryColor:
      typeof body?.primaryColor === "string"
        ? body.primaryColor
        : null,
    secondaryColor:
      typeof body?.secondaryColor === "string"
        ? body.secondaryColor
        : null,
    vatRate: safeNumber(body?.vatRate, 0.2),
    serviceCharge: safeNumber(body?.serviceCharge, 0),
  })

  const normalizedDomain = normalizeDomain(
    typeof body?.domain === "string" ? body.domain : null
  )

  const restaurant = await prisma.restaurant.create({
    data: {
      id: restaurantIdFromSlug(slug),
      slug,
      name: branding.name,
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      domain: normalizedDomain || null,
      vatRate: branding.vatRate,
      serviceCharge: branding.serviceCharge,
    },
  })

  const tableCount = Math.max(
    0,
    Math.min(120, Math.floor(safeNumber(body?.tableCount, 0)))
  )

  if (tableCount > 0) {
    await prisma.$transaction(async tx => {
      for (let tableNo = 1; tableNo <= tableCount; tableNo += 1) {
        const externalTagId = `${slug}-t-${String(tableNo).padStart(2, "0")}`
        const tag = await tx.nfcTag.upsert({
          where: {
            restaurantId_tagId: {
              restaurantId: restaurant.id,
              tagId: externalTagId,
            },
          },
          update: {},
          create: {
            restaurantId: restaurant.id,
            tagId: externalTagId,
          },
        })

        await tx.table.upsert({
          where: {
            restaurantId_tableNumber: {
              restaurantId: restaurant.id,
              tableNumber: tableNo,
            },
          },
          update: {},
          create: {
            restaurantId: restaurant.id,
            tableNumber: tableNo,
          },
        })

        await tx.tableAssignment.upsert({
          where: {
            restaurantId_tagId: {
              restaurantId: restaurant.id,
              tagId: externalTagId,
            },
          },
          update: {
            nfcTagId: tag.id,
            tableNo,
            locked: false,
            closedAt: null,
            closedPaid: null,
          },
          create: {
            restaurantId: restaurant.id,
            nfcTagId: tag.id,
            tagId: externalTagId,
            tableNo,
            locked: false,
            closedAt: null,
            closedPaid: null,
          },
        })
      }
    })
  }

  const shouldSeedMenu = body?.seedMenu !== false
  if (shouldSeedMenu) {
    await ensureCanonicalMenu({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    })
  }

  const roleDefaults: Array<{
    role: "admin" | "waiter" | "bar" | "kitchen"
    passcode: string | undefined
  }> = [
    { role: "admin", passcode: process.env.ADMIN_PASSCODE },
    { role: "waiter", passcode: process.env.WAITER_PASSCODE },
    { role: "bar", passcode: process.env.BAR_PASSCODE },
    { role: "kitchen", passcode: process.env.KITCHEN_PASSCODE },
  ]

  for (const roleDefault of roleDefaults) {
    const normalized = roleDefault.passcode?.trim()
    const passcodeHash = normalized
      ? await hashPasscode(normalized)
      : null

    await prisma.staffUser.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: `${restaurant.slug}-${roleDefault.role}`,
        },
      },
      update: {
        role: roleDefault.role,
        active: true,
        passcodeHash,
        passcodeUpdatedAt: passcodeHash ? new Date() : null,
      },
      create: {
        restaurantId: restaurant.id,
        name: `${restaurant.slug}-${roleDefault.role}`,
        role: roleDefault.role,
        passcodeHash,
        passcodeUpdatedAt: passcodeHash ? new Date() : null,
        active: true,
      },
    })
  }

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      domain: restaurant.domain,
      vatRate: restaurant.vatRate,
      serviceCharge: restaurant.serviceCharge,
      orderUrl: externalOrderUrl({
        baseUrl: toBaseUrl(restaurant.domain),
        restaurantSlug: restaurant.slug,
        tableId: "1",
      }),
      dashboardUrl:
        restaurant.slug === DEFAULT_RESTAURANT_SLUG
          ? "/admin"
          : `/r/${restaurant.slug}/dashboard`,
    },
  })
}
