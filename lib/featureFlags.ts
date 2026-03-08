/**
 * Feature Flag System
 *
 * Centralised registry of all toggleable features. Each restaurant
 * can enable/disable any flag. Defaults are provided per plan tier
 * so new restaurants get a sensible starting set.
 *
 * Usage:
 *   Server:  resolveFeatures(restaurant.featureConfig, restaurant.planTier)
 *   Client:  useFeature("loyalty")  →  boolean
 *   JSX:     <FeatureGate feature="loyalty">…</FeatureGate>
 */

// ---------------------------------------------------------------------------
// Feature key enum — single source of truth
// ---------------------------------------------------------------------------

export const FEATURE_KEYS = [
  // ── Ordering & Menu ───────────────────────────────────────────────────
  "nfcTableOrdering",
  "takeawayOrdering",
  "menuDayparts",
  "menuSearch",
  "itemCustomization",
  "allergenDisplay",
  "stockTracking",
  "menuImages",
  "multiLanguageMenu",
  "calorieDisplay",

  // ── Payment & Billing ─────────────────────────────────────────────────
  "tableBilling",
  "splitBilling",
  "tipping",
  "promoCodeRedemption",
  "walletPayments",
  "stripeConnect",
  "receiptEmails",

  // ── Customer Engagement ───────────────────────────────────────────────
  "loyalty",
  "reservations",
  "waitlist",
  "feedback",
  "customerAccounts",
  "socialProof",
  "notifications",
  "guestTools",

  // ── Staff & Operations ────────────────────────────────────────────────
  "kitchenDisplay",
  "barDisplay",
  "waiterView",
  "printJobs",
  "voidAndComp",
  "refire",
  "shiftReports",
  "auditLog",
  "namedStaffAccounts",
  "staffNotifications",

  // ── Delivery & External ───────────────────────────────────────────────
  "deliveryIntegration",
  "uberEats",
  "deliveroo",
  "justEat",

  // ── Analytics & Growth ────────────────────────────────────────────────
  "uxExperiments",
  "funnelAnalytics",
  "salesDashboard",
  "revenueReports",

  // ── Branding & Theming ────────────────────────────────────────────────
  "customTheme",
  "customBranding",
  "customCopy",
  "customDomain",
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

// ---------------------------------------------------------------------------
// Category metadata (for the admin UI)
// ---------------------------------------------------------------------------

export type FeatureCategory =
  | "ordering"
  | "payments"
  | "engagement"
  | "operations"
  | "delivery"
  | "analytics"
  | "branding"

export type FeatureMeta = {
  key: FeatureKey
  label: string
  description: string
  category: FeatureCategory
  /** Features that must also be enabled for this one to work */
  requires?: FeatureKey[]
  /** If true, the feature can only be unlocked on certain plans */
  minPlan?: PlanTier
}

export const FEATURE_CATALOG: FeatureMeta[] = [
  // ── Ordering & Menu ───────────────────────────────────────────────────
  {
    key: "nfcTableOrdering",
    label: "NFC Table Ordering",
    description: "Guests tap NFC tags to open menus and place orders at their table.",
    category: "ordering",
  },
  {
    key: "takeawayOrdering",
    label: "Takeaway / Collection",
    description: "Accept takeaway or collection orders alongside dine-in.",
    category: "ordering",
  },
  {
    key: "menuDayparts",
    label: "Menu Dayparts",
    description: "Show different menus for breakfast, lunch, dinner, etc.",
    category: "ordering",
    minPlan: "professional",
  },
  {
    key: "menuSearch",
    label: "Menu Search",
    description: "Let guests search for items across all menu sections.",
    category: "ordering",
  },
  {
    key: "itemCustomization",
    label: "Item Customization",
    description: "Allow removals, swaps, and add-ons on menu items.",
    category: "ordering",
  },
  {
    key: "allergenDisplay",
    label: "Allergen Information",
    description: "Display allergen badges and warnings on menu items.",
    category: "ordering",
  },
  {
    key: "stockTracking",
    label: "Stock Tracking",
    description: "Track item availability and auto-hide sold-out items.",
    category: "ordering",
    minPlan: "professional",
  },
  {
    key: "menuImages",
    label: "Menu Item Images",
    description: "Display images alongside menu items.",
    category: "ordering",
  },
  {
    key: "multiLanguageMenu",
    label: "Multi-Language Menu",
    description: "Offer the menu in multiple languages for international guests.",
    category: "ordering",
    minPlan: "enterprise",
  },
  {
    key: "calorieDisplay",
    label: "Calorie Display",
    description: "Show calorie counts on menu items.",
    category: "ordering",
  },

  // ── Payment & Billing ─────────────────────────────────────────────────
  {
    key: "tableBilling",
    label: "Table Billing",
    description: "Track and manage bills at the table level.",
    category: "payments",
  },
  {
    key: "splitBilling",
    label: "Split Billing",
    description: "Allow guests to split the bill between multiple people.",
    category: "payments",
    requires: ["tableBilling"],
  },
  {
    key: "tipping",
    label: "Tipping",
    description: "Prompt guests for tips during checkout.",
    category: "payments",
  },
  {
    key: "promoCodeRedemption",
    label: "Promo Codes",
    description: "Create and accept promotional discount codes.",
    category: "payments",
    minPlan: "professional",
  },
  {
    key: "walletPayments",
    label: "Wallet Payments",
    description: "Accept Apple Pay and Google Pay.",
    category: "payments",
  },
  {
    key: "stripeConnect",
    label: "Stripe Payments",
    description: "Process real payments via Stripe Connect.",
    category: "payments",
  },
  {
    key: "receiptEmails",
    label: "Email Receipts",
    description: "Send digital receipts to guests via email after checkout.",
    category: "payments",
    minPlan: "professional",
  },

  // ── Customer Engagement ───────────────────────────────────────────────
  {
    key: "loyalty",
    label: "Loyalty Programme",
    description: "Points-based loyalty tiers with rewards for repeat customers.",
    category: "engagement",
    minPlan: "professional",
  },
  {
    key: "reservations",
    label: "Reservations",
    description: "Accept and manage table reservations online.",
    category: "engagement",
    minPlan: "professional",
  },
  {
    key: "waitlist",
    label: "Waitlist",
    description: "Manage walk-in queues with SMS/in-app notifications.",
    category: "engagement",
    minPlan: "professional",
  },
  {
    key: "feedback",
    label: "Guest Feedback",
    description: "Collect ratings and comments after the meal.",
    category: "engagement",
  },
  {
    key: "customerAccounts",
    label: "Customer Accounts",
    description: "Let guests create accounts to save preferences and order history.",
    category: "engagement",
    minPlan: "professional",
  },
  {
    key: "socialProof",
    label: "Social Proof",
    description: "Show verified reviews and usage stats on the menu.",
    category: "engagement",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Send SMS, email, or in-app notifications to guests.",
    category: "engagement",
    minPlan: "professional",
  },
  {
    key: "guestTools",
    label: "Guest Tools",
    description: "Quick-access tools for guests: call waiter, request bill, etc.",
    category: "engagement",
  },

  // ── Staff & Operations ────────────────────────────────────────────────
  {
    key: "kitchenDisplay",
    label: "Kitchen Display (KDS)",
    description: "Real-time kitchen order queue with prep state tracking.",
    category: "operations",
  },
  {
    key: "barDisplay",
    label: "Bar Display",
    description: "Dedicated bar queue display for drink orders.",
    category: "operations",
  },
  {
    key: "waiterView",
    label: "Waiter Dashboard",
    description: "Waiter-facing view of tables, orders, and ready items.",
    category: "operations",
  },
  {
    key: "printJobs",
    label: "Ticket Printing",
    description: "Print kitchen/bar tickets for orders.",
    category: "operations",
    minPlan: "professional",
  },
  {
    key: "voidAndComp",
    label: "Void & Comp",
    description: "Allow managers to void or comp individual order lines.",
    category: "operations",
  },
  {
    key: "refire",
    label: "Refire Orders",
    description: "Resend items back to kitchen/bar for re-preparation.",
    category: "operations",
  },
  {
    key: "shiftReports",
    label: "Shift Reports",
    description: "End-of-shift summary with revenue, items, and performance.",
    category: "operations",
    minPlan: "professional",
  },
  {
    key: "auditLog",
    label: "Audit Log",
    description: "Detailed activity log of all staff and system actions.",
    category: "operations",
    minPlan: "professional",
  },
  {
    key: "namedStaffAccounts",
    label: "Named Staff Accounts",
    description: "Individual staff logins instead of shared role passcodes.",
    category: "operations",
    minPlan: "professional",
  },
  {
    key: "staffNotifications",
    label: "Staff Notifications",
    description: "Real-time alerts for staff on new orders, ready items, etc.",
    category: "operations",
  },

  // ── Delivery & External ───────────────────────────────────────────────
  {
    key: "deliveryIntegration",
    label: "Delivery Integration",
    description: "Accept orders from third-party delivery platforms.",
    category: "delivery",
    minPlan: "enterprise",
  },
  {
    key: "uberEats",
    label: "Uber Eats",
    description: "Sync orders from Uber Eats into the kitchen queue.",
    category: "delivery",
    requires: ["deliveryIntegration"],
    minPlan: "enterprise",
  },
  {
    key: "deliveroo",
    label: "Deliveroo",
    description: "Sync orders from Deliveroo into the kitchen queue.",
    category: "delivery",
    requires: ["deliveryIntegration"],
    minPlan: "enterprise",
  },
  {
    key: "justEat",
    label: "Just Eat",
    description: "Sync orders from Just Eat into the kitchen queue.",
    category: "delivery",
    requires: ["deliveryIntegration"],
    minPlan: "enterprise",
  },

  // ── Analytics & Growth ────────────────────────────────────────────────
  {
    key: "uxExperiments",
    label: "A/B Testing",
    description: "Run UX experiments with traffic splitting and variant tracking.",
    category: "analytics",
    minPlan: "professional",
  },
  {
    key: "funnelAnalytics",
    label: "Funnel Analytics",
    description: "Track the customer journey from menu to checkout.",
    category: "analytics",
    minPlan: "professional",
  },
  {
    key: "salesDashboard",
    label: "Sales Dashboard",
    description: "Visual revenue, order volume, and item performance charts.",
    category: "analytics",
  },
  {
    key: "revenueReports",
    label: "Revenue Reports",
    description: "Exportable daily/weekly/monthly revenue breakdowns.",
    category: "analytics",
    minPlan: "professional",
  },

  // ── Branding & Theming ────────────────────────────────────────────────
  {
    key: "customTheme",
    label: "Custom Theme",
    description: "Customise colours, fonts, and border radius.",
    category: "branding",
  },
  {
    key: "customBranding",
    label: "Custom Branding",
    description: "Upload your own logo and hero images.",
    category: "branding",
  },
  {
    key: "customCopy",
    label: "Custom Copy",
    description: "Edit all customer-facing text and labels.",
    category: "branding",
    minPlan: "professional",
  },
  {
    key: "customDomain",
    label: "Custom Domain",
    description: "Use your own domain name for the customer-facing site.",
    category: "branding",
    minPlan: "enterprise",
  },
]

// ---------------------------------------------------------------------------
// Plan tiers & per-plan defaults
// ---------------------------------------------------------------------------

export type PlanTier = "starter" | "professional" | "enterprise"

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
}

/** Which features are ON by default per plan. */
const PLAN_DEFAULTS: Record<PlanTier, FeatureKey[]> = {
  starter: [
    "nfcTableOrdering",
    "menuSearch",
    "itemCustomization",
    "allergenDisplay",
    "menuImages",
    "calorieDisplay",
    "tableBilling",
    "tipping",
    "walletPayments",
    "feedback",
    "socialProof",
    "guestTools",
    "kitchenDisplay",
    "barDisplay",
    "waiterView",
    "voidAndComp",
    "refire",
    "staffNotifications",
    "salesDashboard",
    "customTheme",
    "customBranding",
  ],
  professional: [
    // includes everything in starter
    "nfcTableOrdering",
    "takeawayOrdering",
    "menuDayparts",
    "menuSearch",
    "itemCustomization",
    "allergenDisplay",
    "stockTracking",
    "menuImages",
    "calorieDisplay",
    "tableBilling",
    "splitBilling",
    "tipping",
    "promoCodeRedemption",
    "walletPayments",
    "stripeConnect",
    "receiptEmails",
    "loyalty",
    "reservations",
    "waitlist",
    "feedback",
    "customerAccounts",
    "socialProof",
    "notifications",
    "guestTools",
    "kitchenDisplay",
    "barDisplay",
    "waiterView",
    "printJobs",
    "voidAndComp",
    "refire",
    "shiftReports",
    "auditLog",
    "namedStaffAccounts",
    "staffNotifications",
    "uxExperiments",
    "funnelAnalytics",
    "salesDashboard",
    "revenueReports",
    "customTheme",
    "customBranding",
    "customCopy",
  ],
  enterprise: [
    // everything
    ...FEATURE_KEYS,
  ],
}

// ---------------------------------------------------------------------------
// Feature config type (stored per restaurant as JSON)
// ---------------------------------------------------------------------------

export type RestaurantFeatureConfig = Partial<Record<FeatureKey, boolean>>

// ---------------------------------------------------------------------------
// Resolution: merge plan defaults → per-restaurant overrides
// ---------------------------------------------------------------------------

export function defaultFeaturesForPlan(plan: PlanTier): Record<FeatureKey, boolean> {
  const defaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.starter
  const result = {} as Record<FeatureKey, boolean>
  for (const key of FEATURE_KEYS) {
    result[key] = defaults.includes(key)
  }
  return result
}

export function resolveFeatures(
  overrides: RestaurantFeatureConfig | null | undefined,
  plan: PlanTier
): Record<FeatureKey, boolean> {
  const base = defaultFeaturesForPlan(plan)
  if (!overrides) return base
  for (const key of FEATURE_KEYS) {
    if (typeof overrides[key] === "boolean") {
      base[key] = overrides[key]
    }
  }
  return base
}

// ---------------------------------------------------------------------------
// Dependency validation — warn if a feature is enabled without its deps
// ---------------------------------------------------------------------------

export type FeatureValidationWarning = {
  feature: FeatureKey
  missingDep: FeatureKey
  message: string
}

export function validateFeatureDependencies(
  resolved: Record<FeatureKey, boolean>
): FeatureValidationWarning[] {
  const warnings: FeatureValidationWarning[] = []
  for (const meta of FEATURE_CATALOG) {
    if (!resolved[meta.key]) continue
    for (const dep of meta.requires ?? []) {
      if (!resolved[dep]) {
        const depMeta = FEATURE_CATALOG.find(m => m.key === dep)
        warnings.push({
          feature: meta.key,
          missingDep: dep,
          message: `"${meta.label}" requires "${depMeta?.label ?? dep}" to be enabled.`,
        })
      }
    }
  }
  return warnings
}

// ---------------------------------------------------------------------------
// Plan-gate check — is a feature available on the restaurant's plan?
// ---------------------------------------------------------------------------

const PLAN_RANK: Record<PlanTier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
}

export function isFeatureAvailableOnPlan(
  featureKey: FeatureKey,
  plan: PlanTier
): boolean {
  const meta = FEATURE_CATALOG.find(m => m.key === featureKey)
  if (!meta) return false
  if (!meta.minPlan) return true
  return PLAN_RANK[plan] >= PLAN_RANK[meta.minPlan]
}

// ---------------------------------------------------------------------------
// Category helpers (for admin UI grouping)
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  ordering: "Ordering & Menu",
  payments: "Payment & Billing",
  engagement: "Customer Engagement",
  operations: "Staff & Operations",
  delivery: "Delivery & External",
  analytics: "Analytics & Growth",
  branding: "Branding & Theming",
}

export const CATEGORY_ORDER: FeatureCategory[] = [
  "ordering",
  "payments",
  "engagement",
  "operations",
  "delivery",
  "analytics",
  "branding",
]

export function featuresByCategory(): Record<FeatureCategory, FeatureMeta[]> {
  const result = {} as Record<FeatureCategory, FeatureMeta[]>
  for (const cat of CATEGORY_ORDER) {
    result[cat] = FEATURE_CATALOG.filter(m => m.category === cat)
  }
  return result
}
