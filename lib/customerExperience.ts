import type {
  CustomerCheckoutFlow,
  CustomerEngagementFlow,
  CustomerExperienceConfig,
  CustomerMenuDiscoveryFlow,
  CustomerOrderingFlow,
  CustomerReviewFlow,
  CustomerTrustMicrocopyLevel,
} from "@/lib/types"
import { isSalesDemoSlug } from "@/lib/tenant"

export const DEFAULT_CUSTOMER_EXPERIENCE_CONFIG: CustomerExperienceConfig = {
  menu: {
    heroTitle: "Menu",
    heroSubtitle:
      "This starter menu is intentionally generic. Replace section and item names before launch.",
    showMetaStats: true,
    showPlaceholderNote: true,
    primaryCtaLabel: "Guest tools",
    primaryCtaHref: "/guest-tools",
    secondaryCtaLabel: "Pay table",
    secondaryCtaHref: "/pay/1",
  },
  review: {
    title: "Review Order",
    subtitleDineIn:
      "Only your items will be added to the table. You can add more items later.",
    subtitleTakeaway: "This order will be sent as takeaway.",
    placeOrderLabel: "Place order",
    backLabel: "Back",
    confirmDineIn: "Place these items to the table now.",
    confirmTakeaway: "Place this takeaway order now.",
    showAllergens: true,
  },
  theme: {
    fontPreset: "SANS",
    radiusPreset: "SOFT",
    customerPrimary: "#7d5a2a",
    customerSurface: "#f7efde",
    customerText: "#2c2418",
    customerFocus: "#8f6a3a",
    staffPrimary: "#4d7ff4",
  },
  launch: {
    isPublished: false,
  },
  ux: {
    menuDiscovery: "HERO_FIRST",
    ordering: "BOTTOM_SHEET_FAST",
    review: "SHEET_REVIEW",
    checkout: "ONE_PAGE",
    engagement: "ALL_IN_ONE",
    showProgressAnchors: true,
    emphasizeSocialProof: false,
    trustMicrocopy: "BALANCED",
    defaultTipPercent: 10,
  },
}

export const SALES_DEMO_CUSTOMER_EXPERIENCE_CONFIG: CustomerExperienceConfig = {
  menu: {
    ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.menu,
    heroTitle: "Live Sales Demo Menu",
    heroSubtitle:
      "Live sales demo build: polished guest flow, editable menu items, and fast checkout.",
    primaryCtaLabel: "Guest tools",
    primaryCtaHref: "/guest-tools",
    secondaryCtaLabel: "Demo checkout",
    secondaryCtaHref: "/pay/1",
  },
  review: {
    ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.review,
    subtitleDineIn:
      "This demo adds only your items to the shared table so add-ons stay accurate.",
  },
  theme: {
    ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.theme,
    fontPreset: "SERIF",
    radiusPreset: "ROUND",
    customerPrimary: "#c38a36",
    customerSurface: "#f2e7d1",
    customerText: "#2a1e10",
    customerFocus: "#d09a48",
    staffPrimary: "#6c9dff",
  },
  launch: {
    isPublished: true,
  },
  ux: {
    ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux,
    menuDiscovery: "SECTION_FIRST",
    ordering: "GUIDED_CONFIGURATOR",
    checkout: "EXPRESS_FIRST",
    engagement: "TASK_TABS",
    emphasizeSocialProof: true,
    trustMicrocopy: "HIGH_ASSURANCE",
    defaultTipPercent: 12.5,
  },
}

function sanitizeText(
  value: unknown,
  fallback: string,
  maxLength: number
) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (trimmed === "") return fallback
  return trimmed.slice(0, maxLength)
}

function sanitizeHref(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return fallback
  if (trimmed.startsWith("//")) return fallback
  return trimmed
}

function sanitizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function sanitizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  return fallback
}

function sanitizeFontPreset(
  value: unknown,
  fallback: CustomerExperienceConfig["theme"]["fontPreset"]
): CustomerExperienceConfig["theme"]["fontPreset"] {
  if (value === "SANS" || value === "SERIF" || value === "MONO") {
    return value
  }
  return fallback
}

function sanitizeRadiusPreset(
  value: unknown,
  fallback: CustomerExperienceConfig["theme"]["radiusPreset"]
): CustomerExperienceConfig["theme"]["radiusPreset"] {
  if (value === "SOFT" || value === "ROUND" || value === "SHARP") {
    return value
  }
  return fallback
}

function sanitizeMenuDiscoveryFlow(
  value: unknown,
  fallback: CustomerMenuDiscoveryFlow
) {
  if (
    value === "HERO_FIRST" ||
    value === "SECTION_FIRST" ||
    value === "SEARCH_FIRST"
  ) {
    return value
  }
  return fallback
}

function sanitizeOrderingFlow(
  value: unknown,
  fallback: CustomerOrderingFlow
) {
  if (
    value === "BOTTOM_SHEET_FAST" ||
    value === "INLINE_STEPPER" ||
    value === "GUIDED_CONFIGURATOR"
  ) {
    return value
  }
  return fallback
}

function sanitizeReviewFlow(
  value: unknown,
  fallback: CustomerReviewFlow
) {
  if (value === "SHEET_REVIEW" || value === "PAGE_REVIEW") {
    return value
  }
  return fallback
}

function sanitizeCheckoutFlow(
  value: unknown,
  fallback: CustomerCheckoutFlow
) {
  if (
    value === "ONE_PAGE" ||
    value === "GUIDED_SPLIT" ||
    value === "EXPRESS_FIRST"
  ) {
    return value
  }
  return fallback
}

function sanitizeEngagementFlow(
  value: unknown,
  fallback: CustomerEngagementFlow
) {
  if (
    value === "ALL_IN_ONE" ||
    value === "TASK_TABS" ||
    value === "POST_PURCHASE_PROMPT"
  ) {
    return value
  }
  return fallback
}

function sanitizeTrustMicrocopyLevel(
  value: unknown,
  fallback: CustomerTrustMicrocopyLevel
) {
  if (
    value === "MINIMAL" ||
    value === "BALANCED" ||
    value === "HIGH_ASSURANCE"
  ) {
    return value
  }
  return fallback
}

function sanitizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Number(parsed.toFixed(2))))
}

export function cloneCustomerExperienceConfig(
  value: CustomerExperienceConfig
): CustomerExperienceConfig {
  return {
    menu: {
      ...value.menu,
    },
    review: {
      ...value.review,
    },
    theme: {
      ...value.theme,
    },
    launch: {
      ...value.launch,
    },
    ux: {
      ...value.ux,
    },
  }
}

export function customerExperienceDefaultsForRestaurant(input: {
  slug: string
  isDemo: boolean
}): CustomerExperienceConfig {
  if (input.isDemo && isSalesDemoSlug(input.slug)) {
    return cloneCustomerExperienceConfig(
      SALES_DEMO_CUSTOMER_EXPERIENCE_CONFIG
    )
  }
  return cloneCustomerExperienceConfig(DEFAULT_CUSTOMER_EXPERIENCE_CONFIG)
}

export function sanitizeCustomerExperienceConfig(
  value: unknown,
  options?: {
    defaults?: CustomerExperienceConfig
  }
): CustomerExperienceConfig {
  const defaults =
    options?.defaults ?? DEFAULT_CUSTOMER_EXPERIENCE_CONFIG
  const root = typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}
  const menu = typeof root.menu === "object" && root.menu !== null
    ? (root.menu as Record<string, unknown>)
    : {}
  const review = typeof root.review === "object" && root.review !== null
    ? (root.review as Record<string, unknown>)
    : {}
  const theme = typeof root.theme === "object" && root.theme !== null
    ? (root.theme as Record<string, unknown>)
    : {}
  const launch = typeof root.launch === "object" && root.launch !== null
    ? (root.launch as Record<string, unknown>)
    : {}
  const ux = typeof root.ux === "object" && root.ux !== null
    ? (root.ux as Record<string, unknown>)
    : {}

  return {
    menu: {
      heroTitle: sanitizeText(
        menu.heroTitle,
        defaults.menu.heroTitle,
        80
      ),
      heroSubtitle: sanitizeText(
        menu.heroSubtitle,
        defaults.menu.heroSubtitle,
        220
      ),
      showMetaStats: sanitizeBoolean(
        menu.showMetaStats,
        defaults.menu.showMetaStats
      ),
      showPlaceholderNote: sanitizeBoolean(
        menu.showPlaceholderNote,
        defaults.menu.showPlaceholderNote
      ),
      primaryCtaLabel: sanitizeText(
        menu.primaryCtaLabel,
        defaults.menu.primaryCtaLabel,
        32
      ),
      primaryCtaHref: sanitizeHref(
        menu.primaryCtaHref,
        defaults.menu.primaryCtaHref
      ),
      secondaryCtaLabel: sanitizeText(
        menu.secondaryCtaLabel,
        defaults.menu.secondaryCtaLabel,
        32
      ),
      secondaryCtaHref: sanitizeHref(
        menu.secondaryCtaHref,
        defaults.menu.secondaryCtaHref
      ),
    },
    review: {
      title: sanitizeText(
        review.title,
        defaults.review.title,
        80
      ),
      subtitleDineIn: sanitizeText(
        review.subtitleDineIn,
        defaults.review.subtitleDineIn,
        200
      ),
      subtitleTakeaway: sanitizeText(
        review.subtitleTakeaway,
        defaults.review.subtitleTakeaway,
        200
      ),
      placeOrderLabel: sanitizeText(
        review.placeOrderLabel,
        defaults.review.placeOrderLabel,
        32
      ),
      backLabel: sanitizeText(
        review.backLabel,
        defaults.review.backLabel,
        32
      ),
      confirmDineIn: sanitizeText(
        review.confirmDineIn,
        defaults.review.confirmDineIn,
        200
      ),
      confirmTakeaway: sanitizeText(
        review.confirmTakeaway,
        defaults.review.confirmTakeaway,
        200
      ),
      showAllergens: sanitizeBoolean(
        review.showAllergens,
        defaults.review.showAllergens
      ),
    },
    theme: {
      fontPreset: sanitizeFontPreset(
        theme.fontPreset,
        defaults.theme.fontPreset
      ),
      radiusPreset: sanitizeRadiusPreset(
        theme.radiusPreset,
        defaults.theme.radiusPreset
      ),
      customerPrimary: sanitizeHexColor(
        theme.customerPrimary,
        defaults.theme.customerPrimary
      ),
      customerSurface: sanitizeHexColor(
        theme.customerSurface,
        defaults.theme.customerSurface
      ),
      customerText: sanitizeHexColor(
        theme.customerText,
        defaults.theme.customerText
      ),
      customerFocus: sanitizeHexColor(
        theme.customerFocus,
        defaults.theme.customerFocus
      ),
      staffPrimary: sanitizeHexColor(
        theme.staffPrimary,
        defaults.theme.staffPrimary
      ),
    },
    launch: {
      isPublished: sanitizeBoolean(
        launch.isPublished,
        defaults.launch.isPublished
      ),
    },
    ux: {
      menuDiscovery: sanitizeMenuDiscoveryFlow(
        ux.menuDiscovery,
        defaults.ux.menuDiscovery
      ),
      ordering: sanitizeOrderingFlow(
        ux.ordering,
        defaults.ux.ordering
      ),
      review: sanitizeReviewFlow(
        ux.review,
        defaults.ux.review
      ),
      checkout: sanitizeCheckoutFlow(
        ux.checkout,
        defaults.ux.checkout
      ),
      engagement: sanitizeEngagementFlow(
        ux.engagement,
        defaults.ux.engagement
      ),
      showProgressAnchors: sanitizeBoolean(
        ux.showProgressAnchors,
        defaults.ux.showProgressAnchors
      ),
      emphasizeSocialProof: sanitizeBoolean(
        ux.emphasizeSocialProof,
        defaults.ux.emphasizeSocialProof
      ),
      trustMicrocopy: sanitizeTrustMicrocopyLevel(
        ux.trustMicrocopy,
        defaults.ux.trustMicrocopy
      ),
      defaultTipPercent: sanitizeNumber(
        ux.defaultTipPercent,
        defaults.ux.defaultTipPercent,
        0,
        30
      ),
    },
  }
}
