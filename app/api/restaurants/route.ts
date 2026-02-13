import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStaff } from "@/lib/auth"
import { DEFAULT_RESTAURANT_SLUG } from "@/lib/restaurantConstants"
import {
  externalOrderUrl,
  getBrandingConfig,
  normalizeDomain,
} from "@/lib/restaurants"
import { ensureCanonicalMenu } from "@/lib/menuCatalog"

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

export async function GET(req: Request) {
  const staff = (() => {
    try {
      return requireStaff(req)
    } catch {
      return null
    }
  })()
  if (!staff) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  if (staff.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
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
  const staff = (() => {
    try {
      return requireStaff(req)
    } catch {
      return null
    }
  })()
  if (!staff) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }
  if (staff.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
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
      id: slug,
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
    for (let tableNo = 1; tableNo <= tableCount; tableNo += 1) {
      const tagId = `${slug}-t-${String(tableNo).padStart(2, "0")}`
      await prisma.nfcTag.upsert({
        where: { id: tagId },
        update: {
          restaurantId: restaurant.id,
        },
        create: {
          id: tagId,
          restaurantId: restaurant.id,
        },
      })
      await prisma.tableAssignment.upsert({
        where: { tagId },
        update: {
          restaurantId: restaurant.id,
          tableNo,
        },
        create: {
          restaurantId: restaurant.id,
          tagId,
          tableNo,
        },
      })
    }
  }

  const shouldSeedMenu = body?.seedMenu !== false
  if (shouldSeedMenu) {
    await ensureCanonicalMenu({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    })
  }

  await prisma.staffUser.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        name: `${restaurant.slug}-admin`,
        role: "admin",
        passcode: process.env.ADMIN_PASSCODE ?? process.env.STAFF_AUTH_SECRET ?? null,
      },
      {
        restaurantId: restaurant.id,
        name: `${restaurant.slug}-waiter`,
        role: "waiter",
        passcode: process.env.WAITER_PASSCODE ?? process.env.STAFF_AUTH_SECRET ?? null,
      },
      {
        restaurantId: restaurant.id,
        name: `${restaurant.slug}-bar`,
        role: "bar",
        passcode: process.env.BAR_PASSCODE ?? process.env.STAFF_AUTH_SECRET ?? null,
      },
      {
        restaurantId: restaurant.id,
        name: `${restaurant.slug}-kitchen`,
        role: "kitchen",
        passcode: process.env.KITCHEN_PASSCODE ?? process.env.STAFF_AUTH_SECRET ?? null,
      },
    ],
    skipDuplicates: true,
  })

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
