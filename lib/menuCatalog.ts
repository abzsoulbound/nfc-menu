import { Prisma, Station } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { menu as bootstrapMenu } from "@/lib/menu-data"
import { DEFAULT_RESTAURANT_SLUG } from "@/lib/restaurantConstants"
import {
  getMenuItemCustomization,
  type MenuCustomization,
} from "@/lib/menuCustomizations"

type MenuItemDto = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  station: Station
  available: boolean
  customization?: MenuCustomization | null
}

type MenuSectionDto = {
  id: string
  name: string
  items: MenuItemDto[]
}

function asJsonArray(value: string[]): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function parseAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function toStation(value: string): Station {
  return value === "BAR" ? "BAR" : "KITCHEN"
}

function scopedCategorySlug(restaurantSlug: string, sectionSlug: string) {
  if (restaurantSlug === DEFAULT_RESTAURANT_SLUG) return sectionSlug
  return `${restaurantSlug}::${sectionSlug}`
}

function displayCategorySlug(
  restaurantSlug: string,
  storedSlug: string
) {
  if (restaurantSlug === DEFAULT_RESTAURANT_SLUG) return storedSlug
  const prefix = `${restaurantSlug}::`
  return storedSlug.startsWith(prefix)
    ? storedSlug.slice(prefix.length)
    : storedSlug
}

function scopedMenuItemId(restaurantSlug: string, menuItemId: string) {
  if (restaurantSlug === DEFAULT_RESTAURANT_SLUG) return menuItemId
  return `${restaurantSlug}::${menuItemId}`
}

export async function ensureCanonicalMenu(input: {
  restaurantId: string
  restaurantSlug: string
}) {
  const itemCount = await prisma.menuItem.count({
    where: { restaurantId: input.restaurantId },
  })
  if (itemCount > 0) return

  for (const [sectionIndex, section] of bootstrapMenu.entries()) {
    const storedCategorySlug = scopedCategorySlug(
      input.restaurantSlug,
      section.id
    )
    const category = await prisma.menuCategory.upsert({
      where: {
        restaurantId_slug: {
          restaurantId: input.restaurantId,
          slug: storedCategorySlug,
        },
      },
      update: {
        name: section.name,
        sortOrder: sectionIndex,
      },
      create: {
        restaurantId: input.restaurantId,
        slug: storedCategorySlug,
        name: section.name,
        sortOrder: sectionIndex,
      },
    })

    for (const [itemIndex, item] of section.items.entries()) {
      const storedMenuItemId = scopedMenuItemId(
        input.restaurantSlug,
        item.id
      )
      await prisma.menuItem.upsert({
        where: { id: storedMenuItemId },
        update: {
          restaurantId: input.restaurantId,
          categoryId: category.id,
          sortOrder: itemIndex,
          name: item.name,
          description: item.description,
          image: item.image,
          basePrice: item.basePrice,
          vatRate: item.vatRate,
          allergens: asJsonArray(item.allergens),
          station: toStation(item.station),
          available: true,
        },
        create: {
          id: storedMenuItemId,
          restaurantId: input.restaurantId,
          categoryId: category.id,
          sortOrder: itemIndex,
          name: item.name,
          description: item.description,
          image: item.image,
          basePrice: item.basePrice,
          vatRate: item.vatRate,
          allergens: asJsonArray(item.allergens),
          station: toStation(item.station),
          available: true,
        },
      })
    }
  }
}

export async function getCanonicalMenu(input: {
  restaurantId: string
  restaurantSlug: string
}) {
  await ensureCanonicalMenu(input)
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: input.restaurantId },
    include: {
      items: {
        where: { restaurantId: input.restaurantId },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: {
      sortOrder: "asc",
    },
  })

  const menu: MenuSectionDto[] = categories.map(category => ({
    id: displayCategorySlug(input.restaurantSlug, category.slug),
    name: category.name,
    items: category.items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      image: item.image,
      basePrice: item.basePrice,
      vatRate: item.vatRate,
      allergens: parseAllergens(item.allergens),
      station: item.station,
      available: item.available,
      customization: getMenuItemCustomization({
        id: item.id,
        name: item.name,
        description: item.description,
        station: item.station,
        allergens: parseAllergens(item.allergens),
      }),
    })),
  }))

  return menu
}

export async function findMenuItemForCart(payload: {
  menuItemId?: string
  name?: string
  restaurantId: string
  restaurantSlug: string
}) {
  await ensureCanonicalMenu(payload)

  if (payload.menuItemId) {
    const item = await prisma.menuItem.findUnique({
      where: { id: payload.menuItemId },
    })
    if (!item || item.restaurantId !== payload.restaurantId) return null
    return item
  }

  if (payload.name) {
    return prisma.menuItem.findFirst({
      where: {
        restaurantId: payload.restaurantId,
        name: payload.name,
      },
      orderBy: { createdAt: "asc" },
    })
  }

  return null
}
