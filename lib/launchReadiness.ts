import { DEFAULT_CUSTOMER_EXPERIENCE_CONFIG } from "@/lib/customerExperience"
import type {
  CustomerExperienceConfig,
  LaunchChecklistItem,
  LaunchReadiness,
  MenuSection,
  StaffRole,
} from "@/lib/types"

type PaymentMode = "SIMULATED" | "EXTERNAL"

type RestaurantStaffAuth = Record<StaffRole, string[]>

type RestaurantProfileLike = {
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
}

const WEAK_PASSCODES = new Set([
  "0000",
  "1111",
  "1234",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
])

function isGenericRestaurantName(name: string) {
  const normalized = name.trim().toLowerCase()
  return (
    normalized === "" ||
    normalized === "restaurant demo" ||
    normalized === "restaurant template" ||
    normalized === "demo template" ||
    normalized === "new restaurant"
  )
}

function menuStats(menu: MenuSection[]) {
  let itemCount = 0
  let genericItemCount = 0
  let placeholderDescriptionCount = 0

  for (const section of menu) {
    for (const item of section.items) {
      itemCount += 1
      if (/^item\s+\d+$/i.test(item.name.trim())) {
        genericItemCount += 1
      }
      if (
        /replace|starter menu|placeholder/i.test(
          item.description.trim()
        )
      ) {
        placeholderDescriptionCount += 1
      }
    }
  }

  return {
    sections: menu.length,
    itemCount,
    genericItemCount,
    placeholderDescriptionCount,
  }
}

function staffAuthStatus(staffAuth: RestaurantStaffAuth) {
  const all = Object.values(staffAuth).flat()
  const total = all.length
  const unique = new Set(all).size
  const hasWeak = all.some(code => WEAK_PASSCODES.has(code))
  return {
    total,
    unique,
    hasWeak,
  }
}

function themeIsCustomized(experienceConfig: CustomerExperienceConfig) {
  const current = experienceConfig.theme
  const defaults = DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.theme
  return (
    current.fontPreset !== defaults.fontPreset ||
    current.radiusPreset !== defaults.radiusPreset ||
    current.customerPrimary !== defaults.customerPrimary ||
    current.customerSurface !== defaults.customerSurface ||
    current.customerText !== defaults.customerText ||
    current.customerFocus !== defaults.customerFocus ||
    current.staffPrimary !== defaults.staffPrimary
  )
}

function makeItem(
  id: string,
  label: string,
  done: boolean,
  detail: string
): LaunchChecklistItem {
  return {
    id,
    label,
    done,
    detail,
  }
}

export function computeLaunchReadiness(input: {
  restaurant: RestaurantProfileLike
  menu: MenuSection[]
  staffAuth: RestaurantStaffAuth
  paymentMode: PaymentMode
}): LaunchReadiness {
  const { restaurant, menu, staffAuth, paymentMode } = input
  const stats = menuStats(menu)
  const auth = staffAuthStatus(staffAuth)
  const needsExternalPayments =
    !restaurant.isDemo && paymentMode === "EXTERNAL"
  const paymentsReady = needsExternalPayments
    ? restaurant.payment.stripeAccountStatus === "CONNECTED" &&
      restaurant.payment.chargesEnabled === true &&
      restaurant.payment.detailsSubmitted === true
    : true

  const items = [
    makeItem(
      "brand-name",
      "Brand name is set",
      !isGenericRestaurantName(restaurant.name),
      isGenericRestaurantName(restaurant.name)
        ? "Replace generic demo/template naming with the real venue name."
        : "Brand name is customized."
    ),
    makeItem(
      "brand-location",
      "Location is provided",
      !!restaurant.location && restaurant.location.trim() !== "",
      restaurant.location
        ? "Location is configured."
        : "Add a location so guests know which venue they are ordering from."
    ),
    makeItem(
      "brand-assets",
      "Brand assets are uploaded",
      !!restaurant.assets.logoUrl || !!restaurant.assets.heroUrl,
      restaurant.assets.logoUrl || restaurant.assets.heroUrl
        ? "At least one brand image is configured."
        : "Upload logo and/or hero image before go live."
    ),
    makeItem(
      "menu-volume",
      "Menu has launch-ready volume",
      stats.sections >= 3 && stats.itemCount >= 8,
      `Current menu has ${stats.sections} sections and ${stats.itemCount} items.`
    ),
    makeItem(
      "menu-generic",
      "Generic menu placeholders removed",
      stats.genericItemCount === 0 && stats.placeholderDescriptionCount === 0,
      stats.genericItemCount === 0 && stats.placeholderDescriptionCount === 0
        ? "No generic placeholder menu copy detected."
        : `Found ${stats.genericItemCount} generic item names and ${stats.placeholderDescriptionCount} placeholder descriptions.`
    ),
    makeItem(
      "theme",
      "Theme is customized",
      themeIsCustomized(restaurant.experienceConfig),
      themeIsCustomized(restaurant.experienceConfig)
        ? "Theme tokens are customized."
        : "Adjust colors, radius, and font preset to match venue branding."
    ),
    makeItem(
      "staff-auth",
      "Staff access credentials are secure",
      auth.total >= 5 && auth.unique === auth.total && !auth.hasWeak,
      auth.total < 5
        ? "Configure distinct passcodes for all staff roles."
        : auth.hasWeak
          ? "Rotate weak/default passcodes before launch."
          : auth.unique !== auth.total
            ? "Resolve duplicate passcodes across roles."
            : "Staff credentials are unique and non-default."
    ),
    makeItem(
      "payments",
      "Payments are configured",
      paymentsReady,
      paymentsReady
        ? "Payment requirement is satisfied for this tenant."
        : "Complete Stripe Connect onboarding and enable charges."
    ),
  ]

  const completeCount = items.filter(item => item.done).length
  const score = Math.round((completeCount / items.length) * 100)
  const ready = completeCount === items.length
  return {
    ready,
    score,
    items,
  }
}
