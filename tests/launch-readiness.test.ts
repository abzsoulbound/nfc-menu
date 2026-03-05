import { describe, expect, it } from "vitest"
import { DEFAULT_CUSTOMER_EXPERIENCE_CONFIG } from "@/lib/customerExperience"
import { computeLaunchReadiness } from "@/lib/launchReadiness"
import { TEMPLATE_MENU } from "@/lib/menuSeed"
import type { MenuSection } from "@/lib/types"

function buildLaunchReadyMenu(): MenuSection[] {
  return [
    {
      id: "starters",
      name: "Starters",
      items: [
        {
          id: "starter-1",
          name: "Tomato Soup",
          description: "Roasted tomato soup with basil.",
          image: "/placeholders/ai-item-kitchen.svg",
          basePrice: 6.5,
          vatRate: 0.175,
          allergens: [],
          station: "KITCHEN",
        },
        {
          id: "starter-2",
          name: "Grilled Halloumi",
          description: "Halloumi with lemon and herbs.",
          image: "/placeholders/ai-item-kitchen.svg",
          basePrice: 8.5,
          vatRate: 0.175,
          allergens: [],
          station: "KITCHEN",
        },
      ],
    },
    {
      id: "mains",
      name: "Mains",
      items: [
        {
          id: "main-1",
          name: "Classic Burger",
          description: "Beef burger with fries and salad.",
          image: "/placeholders/ai-item-kitchen.svg",
          basePrice: 14,
          vatRate: 0.175,
          allergens: [],
          station: "KITCHEN",
        },
        {
          id: "main-2",
          name: "Sea Bass",
          description: "Pan-seared sea bass with greens.",
          image: "/placeholders/ai-item-kitchen.svg",
          basePrice: 17,
          vatRate: 0.175,
          allergens: [],
          station: "KITCHEN",
        },
        {
          id: "main-3",
          name: "Mushroom Risotto",
          description: "Creamy risotto with parmesan.",
          image: "/placeholders/ai-item-kitchen.svg",
          basePrice: 15,
          vatRate: 0.175,
          allergens: [],
          station: "KITCHEN",
        },
      ],
    },
    {
      id: "drinks",
      name: "Drinks",
      items: [
        {
          id: "drink-1",
          name: "Espresso",
          description: "Single origin espresso shot.",
          image: "/placeholders/ai-item-bar.svg",
          basePrice: 3.2,
          vatRate: 0.175,
          allergens: [],
          station: "BAR",
        },
        {
          id: "drink-2",
          name: "Lemonade",
          description: "Fresh lemonade with mint.",
          image: "/placeholders/ai-item-bar.svg",
          basePrice: 4.2,
          vatRate: 0.175,
          allergens: [],
          station: "BAR",
        },
        {
          id: "drink-3",
          name: "Sparkling Water",
          description: "Chilled sparkling water.",
          image: "/placeholders/ai-item-bar.svg",
          basePrice: 2.8,
          vatRate: 0.175,
          allergens: [],
          station: "BAR",
        },
      ],
    },
  ]
}

describe("launch readiness", () => {
  it("flags template-style defaults as not ready", () => {
    const readiness = computeLaunchReadiness({
      restaurant: {
        name: "Restaurant Template",
        location: null,
        assets: {},
        experienceConfig: DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
        isDemo: false,
        payment: {
          stripeAccountStatus: "DISCONNECTED",
          chargesEnabled: false,
          detailsSubmitted: false,
        },
      },
      menu: TEMPLATE_MENU,
      staffAuth: {
        WAITER: ["1111"],
        BAR: ["3333"],
        KITCHEN: ["2222"],
        MANAGER: ["4444"],
        ADMIN: ["9999"],
      },
      paymentMode: "EXTERNAL",
    })

    expect(readiness.ready).toBe(false)
    expect(
      readiness.items.find(item => item.id === "menu-generic")?.done
    ).toBe(false)
    expect(
      readiness.items.find(item => item.id === "payments")?.done
    ).toBe(false)
  })

  it("returns ready when all launch requirements are met", () => {
    const readiness = computeLaunchReadiness({
      restaurant: {
        name: "Acme Bistro",
        location: "Leicester, UK",
        assets: {
          logoUrl: "/brand/logo.svg",
          heroUrl: "/brand/hero.jpg",
        },
        experienceConfig: {
          ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
          theme: {
            ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.theme,
            fontPreset: "SERIF",
            customerPrimary: "#6B8E23",
          },
        },
        isDemo: false,
        payment: {
          stripeAccountStatus: "CONNECTED",
          chargesEnabled: true,
          detailsSubmitted: true,
        },
      },
      menu: buildLaunchReadyMenu(),
      staffAuth: {
        WAITER: ["5812"],
        BAR: ["6723"],
        KITCHEN: ["7439"],
        MANAGER: ["8045"],
        ADMIN: ["9156"],
      },
      paymentMode: "EXTERNAL",
    })

    expect(readiness.ready).toBe(true)
    expect(readiness.score).toBe(100)
  })
})
