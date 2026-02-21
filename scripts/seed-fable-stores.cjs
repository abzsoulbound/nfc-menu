const { PrismaClient, Station } = require("@prisma/client")
const dotenv = require("dotenv")

dotenv.config({ path: ".env.local" })

const prisma = new PrismaClient()

const RESTAURANT = {
  id: "rest_fable_stores",
  slug: "fable-stores",
  name: "Fable Stores",
  logoUrl: "/images/fable-stores-logo.png",
  primaryColor: "#4d9fe6",
  secondaryColor: "#deedff",
  vatRate: 0.2,
  serviceCharge: 0,
}

function parseTableNumbers(input) {
  if (!input || typeof input !== "string") return []
  const out = new Set()

  for (const rawToken of input.split(",")) {
    const token = rawToken.trim()
    if (!token) continue

    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue
      const min = Math.min(start, end)
      const max = Math.max(start, end)
      for (let current = min; current <= max; current += 1) {
        if (current > 0) out.add(current)
      }
      continue
    }

    const value = Number(token)
    if (Number.isInteger(value) && value > 0) out.add(value)
  }

  return Array.from(out).sort((a, b) => a - b)
}

function toSkuId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const MENU = [
  {
    slug: "breakfast-brunch",
    name: "Breakfast/Brunch",
    station: Station.KITCHEN,
    items: [
      ["Toasted sourdough with jam & butter", 2.5],
      ["Toasted sourdough with fried eggs, bacon and brown sauce", 6.5],
      ["Homemade sourdough bread, smashed avocado, poached/scrambled egg", 11.0],
      ["Shakshuka with tomatoes, pepper, cumin, onion & garlic, egg and feta", 12.5],
      ["Pancakes with mixed berries and banana", 12.5],
      ["Granola with mixed nuts, fresh berries, chia seeds and greek yogurt", 9.0],
      ["French toast with mixed berries and chocolate sauce", 11.0],
      ["Omelette with any 3 fillings", 12.0],
      ["Eggs Florentine", 12.0],
      ["Charred grilled steak and eggs", 15.0],
    ],
  },
  {
    slug: "mains",
    name: "Mains",
    station: Station.KITCHEN,
    items: [
      ["Australian wagyu rib-eye steak 200g", 34.0],
      ["Black Angus sirloin steak 250-280g", 32.0],
      ["Lamb chops on the bone (4pcs)", 24.5],
      ["Soup of the day served with bread", 6.95],
      ["Tagliatelle with oyster mushrooms and black truffle", 19.0],
      ["Traditional spaghetti carbonara", 17.0],
      ["Traditional rigatoni beef bolognese", 17.0],
      ["Penne arrabbiata", 13.0],
      ["Steak beef burger with homemade sauce and chips", 15.0],
      ["Panko breaded chicken escalope with parmesan fries", 15.0],
      ["Caesar salad", 15.0],
      ["Steak baguette with caramelised onions and rocket", 9.0],
      ["Breaded fish fillets with potato wedges and tartar sauce", 16.0],
      ["Chicken breast in creamy mushroom sauce", 15.0],
    ],
  },
  {
    slug: "traditional-pizzas",
    name: "Traditional Pizzas",
    station: Station.KITCHEN,
    items: [
      ["Margherita D.O.P.", 10.0],
      ["Mascarpone & Speck", 15.0],
      ["Tartufo Nero", 18.0],
      ["Parmigiana", 10.0],
      ["Mortadella e Pistacchio", 19.0],
      ["Ortolana", 15.5],
      ["Pepperoni Classico", 14.0],
      ["Prosciutto Funghi", 15.5],
      ["Nettuno", 14.0],
      ["Pollo Fusion", 15.0],
    ],
  },
  {
    slug: "desserts",
    name: "Desserts",
    station: Station.KITCHEN,
    items: [
      ["Chocolate fondant with vanilla ice cream", 8.0],
      ["Brownie with vanilla ice cream", 8.0],
    ],
  },
  {
    slug: "kids-menu",
    name: "Kids Menu",
    station: Station.KITCHEN,
    items: [
      ["Penne with rich tomato sauce", 7.0],
      ["Kids Margherita", 7.0],
      ["Crispy chicken schnitzel with chips", 8.0],
      ["Beef cheeseburger served with chips", 8.0],
    ],
  },
  {
    slug: "coffee-matcha",
    name: "Coffee/Matcha",
    station: Station.BAR,
    items: [
      ["Espresso", 2.95],
      ["Macchiato", 3.2],
      ["Americano", 3.4],
      ["Cortado", 3.8],
      ["Latte (Hot/Iced)", 3.8],
      ["Matcha latte (Hot/Iced)", 4.5],
      ["Chai latte (Hot/Iced)", 4.2],
      ["Cappuccino", 3.8],
      ["Flat white", 3.7],
      ["Mocha", 4.2],
      ["Hot chocolate", 3.5],
    ],
  },
  {
    slug: "extras",
    name: "Extras",
    station: Station.BAR,
    items: [
      ["Syrup (vanilla/caramel/hazelnut/coconut)", 0.5],
      ["Alternative milk (oat/almond/soya/coconut)", 0.5],
      ["Whipping cream / marshmallow", 0.5],
      ["Collagen", 1.0],
    ],
  },
  {
    slug: "fine-loose-teas",
    name: "Fine Loose Teas",
    station: Station.BAR,
    items: [
      ["English breakfast gold / decaf / earl grey", 3.8],
      ["Chamomile organic", 3.8],
      ["Fog green organic", 3.8],
      ["Jasmine Chung Hao", 3.8],
      ["Lemon & ginger rooibos", 3.8],
      ["Fresh mint tea", 3.4],
    ],
  },
  {
    slug: "smoothies",
    name: "Smoothies",
    station: Station.BAR,
    items: [
      ["Super Green", 6.2],
      ["Berry Burst", 6.0],
      ["Detox", 6.0],
      ["Sunrise Smoothie", 5.9],
    ],
  },
  {
    slug: "alcoholic-drinks",
    name: "Alcoholic Drinks",
    station: Station.BAR,
    items: [
      ["Sauvignon Blanc (175ml)", 8.0],
      ["Sauvignon Blanc (bottle)", 28.0],
      ["Gavi di Gavi (175ml)", 9.0],
      ["Gavi di Gavi (bottle)", 29.0],
      ["Sangiovese Guerrieri Colli Pesaresi (175ml)", 7.5],
      ["Sangiovese Guerrieri Colli Pesaresi (bottle)", 27.0],
      ["Malbec '1300' (175ml)", 8.5],
      ["Malbec '1300' (bottle)", 29.0],
      ["Rose Gold Cotes de Provence (175ml)", 9.5],
      ["Rose Gold Cotes de Provence (bottle)", 32.0],
      ["Prosecco Brut Rose DOC Luna Argenta (125ml)", 7.5],
      ["Prosecco Brut Rose DOC Luna Argenta (bottle)", 32.0],
      ["Prosecco Brut DOC Luna Argenta (125ml)", 7.5],
      ["Prosecco Brut DOC Luna Argenta (bottle)", 32.0],
      ["Aperol Spritz", 9.0],
      ["Campari Spritz", 9.0],
      ["Bombay Sapphire Gin & Tonic", 9.5],
      ["Moretti (330ml)", 4.0],
      ["Camden Hells", 5.0],
      ["Pillars Helles", 6.0],
      ["Pillars Original Pale", 6.0],
      ["Pillars Pilsner", 6.0],
      ["Modelo Especial", 6.0],
      ["Galipette Cider Rose", 6.0],
      ["Galipette Organic Biologique", 6.0],
    ],
  },
]

async function upsertRestaurant(domainValue) {
  const logoUrl =
    typeof process.env.FABLE_LOGO_URL === "string" &&
    process.env.FABLE_LOGO_URL.trim().length > 0
      ? process.env.FABLE_LOGO_URL.trim()
      : RESTAURANT.logoUrl

  const normalizedDomain =
    typeof domainValue === "string" && domainValue.trim().length > 0
      ? domainValue.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
      : null

  if (normalizedDomain) {
    await prisma.restaurant.updateMany({
      where: {
        domain: normalizedDomain,
        slug: { not: RESTAURANT.slug },
      },
      data: { domain: null },
    })
  }

  return prisma.restaurant.upsert({
    where: { slug: RESTAURANT.slug },
    update: {
      name: RESTAURANT.name,
      logoUrl,
      primaryColor: RESTAURANT.primaryColor,
      secondaryColor: RESTAURANT.secondaryColor,
      domain: normalizedDomain,
      vatRate: RESTAURANT.vatRate,
      serviceCharge: RESTAURANT.serviceCharge,
    },
    create: {
      id: RESTAURANT.id,
      slug: RESTAURANT.slug,
      name: RESTAURANT.name,
      logoUrl,
      primaryColor: RESTAURANT.primaryColor,
      secondaryColor: RESTAURANT.secondaryColor,
      domain: normalizedDomain,
      vatRate: RESTAURANT.vatRate,
      serviceCharge: RESTAURANT.serviceCharge,
    },
  })
}

async function ensureTables(restaurantId, tableNumbers) {
  for (const tableNo of tableNumbers) {
    const tagId = `${RESTAURANT.slug}-t-${String(tableNo).padStart(2, "0")}`
    const tag = await prisma.nfcTag.upsert({
      where: {
        restaurantId_tagId: {
          restaurantId,
          tagId,
        },
      },
      update: {},
      create: { restaurantId, tagId },
    })

    await prisma.table.upsert({
      where: {
        restaurantId_tableNumber: {
          restaurantId,
          tableNumber: tableNo,
        },
      },
      update: {},
      create: {
        restaurantId,
        tableNumber: tableNo,
      },
    })

    await prisma.tableAssignment.upsert({
      where: {
        restaurantId_tagId: {
          restaurantId,
          tagId,
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
        restaurantId,
        nfcTagId: tag.id,
        tagId,
        tableNo,
        locked: false,
        closedAt: null,
        closedPaid: null,
      },
    })
  }
}

async function ensureMenu(restaurantId) {
  for (const [sectionIndex, section] of MENU.entries()) {
    const storedCategorySlug = `${RESTAURANT.slug}::${section.slug}`
    const category = await prisma.menuCategory.upsert({
      where: {
        restaurantId_slug: {
          restaurantId,
          slug: storedCategorySlug,
        },
      },
      update: {
        name: section.name,
        sortOrder: sectionIndex,
      },
      create: {
        restaurantId,
        slug: storedCategorySlug,
        name: section.name,
        sortOrder: sectionIndex,
      },
    })

    for (const [itemIndex, item] of section.items.entries()) {
      const [name, price] = item
      const sku = `${section.slug}--${toSkuId(name)}`
      const id = `${RESTAURANT.slug}::${sku}`

      await prisma.menuItem.upsert({
        where: { id },
        update: {
          sku,
          restaurantId,
          categoryId: category.id,
          sortOrder: itemIndex,
          name,
          description: "",
          image: null,
          basePrice: Number(price),
          vatRate: RESTAURANT.vatRate,
          allergens: [],
          station: section.station,
          available: true,
        },
        create: {
          id,
          sku,
          restaurantId,
          categoryId: category.id,
          sortOrder: itemIndex,
          name,
          description: "",
          image: null,
          basePrice: Number(price),
          vatRate: RESTAURANT.vatRate,
          allergens: [],
          station: section.station,
          available: true,
        },
      })
    }
  }
}

async function main() {
  const explicitDomain = process.env.FABLE_DOMAIN || ""
  const restaurant = await upsertRestaurant(explicitDomain)

  const tableInput = process.env.FABLE_TABLE_NUMBERS || process.env.TABLE_NUMBERS || "1-20"
  const tableNumbers = parseTableNumbers(tableInput)
  await ensureTables(restaurant.id, tableNumbers)

  await ensureMenu(restaurant.id)

  console.log("Fable Stores seeded successfully")
  console.log(`Slug: ${restaurant.slug}`)
  console.log(`Domain: ${restaurant.domain || "(not set)"}`)
  console.log(`Tables: ${tableNumbers.join(", ")}`)
  console.log(`Menu sections: ${MENU.length}`)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
