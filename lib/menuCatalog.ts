import { Prisma, Station } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { menu as bootstrapMenu } from "@/lib/menu-data"
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

export async function ensureCanonicalMenu() {
  const itemCount = await prisma.menuItem.count()
  if (itemCount > 0) return

  for (const [sectionIndex, section] of bootstrapMenu.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { slug: section.id },
      update: {
        name: section.name,
        sortOrder: sectionIndex,
      },
      create: {
        slug: section.id,
        name: section.name,
        sortOrder: sectionIndex,
      },
    })

    for (const [itemIndex, item] of section.items.entries()) {
      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: {
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
          id: item.id,
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

export async function getCanonicalMenu() {
  await ensureCanonicalMenu()
  const categories = await prisma.menuCategory.findMany({
    include: {
      items: {
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
    id: category.slug,
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
}) {
  await ensureCanonicalMenu()

  if (payload.menuItemId) {
    return prisma.menuItem.findUnique({
      where: { id: payload.menuItemId },
    })
  }

  if (payload.name) {
    return prisma.menuItem.findFirst({
      where: { name: payload.name },
      orderBy: { createdAt: "asc" },
    })
  }

  return null
}
