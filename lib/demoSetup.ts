export type DemoCustomerRouteKey =
  | "menu"
  | "order"
  | "review"
  | "pay"
  | "tools"

export type DemoStaffRouteKey =
  | "waiter"
  | "kitchen"
  | "bar"
  | "manager"
  | "customize"
  | "features"
  | "admin"

export type DemoRouteCopy = {
  label: string
  desc: string
}

export type DemoSetupConfig = {
  companyName: string
  companyType: string
  pitchGoal: string
  heroTitle: string
  heroSubtitle: string
  spotlightTitle: string
  spotlightBody: string
  priorityOne: string
  priorityTwo: string
  priorityThree: string
  passcodesSectionLabel: string
  customerSectionLabel: string
  staffSectionLabel: string
  simulatorSectionLabel: string
  customerRoutes: Record<DemoCustomerRouteKey, DemoRouteCopy>
  staffRoutes: Record<DemoStaffRouteKey, DemoRouteCopy>
}

type DemoRouteDefinition<TKey extends string> = {
  key: TKey
  nextPath: string
}

export const DEMO_SETUP_STORAGE_KEY = "nfc_demo_setup_v1"
export const DEMO_SETUP_UPDATED_EVENT = "nfc:demo-setup-updated"

export const DEMO_CUSTOMER_ROUTE_DEFINITIONS = [
  { key: "menu", nextPath: "/menu" },
  { key: "order", nextPath: "/order/takeaway" },
  { key: "review", nextPath: "/order/review/demo-tag" },
  { key: "pay", nextPath: "/pay/1" },
  { key: "tools", nextPath: "/guest-tools" },
] as const satisfies readonly DemoRouteDefinition<DemoCustomerRouteKey>[]

export const DEMO_STAFF_ROUTE_DEFINITIONS = [
  { key: "waiter", nextPath: "/staff-login?next=/staff" },
  { key: "kitchen", nextPath: "/staff-login?next=/kitchen" },
  { key: "bar", nextPath: "/staff-login?next=/bar" },
  { key: "manager", nextPath: "/staff-login?next=/manager" },
  { key: "customize", nextPath: "/staff-login?next=/manager/customize" },
  { key: "features", nextPath: "/staff-login?next=/manager/features" },
  { key: "admin", nextPath: "/staff-login?next=/admin" },
] as const satisfies readonly DemoRouteDefinition<DemoStaffRouteKey>[]

const DEFAULT_CUSTOMER_ROUTE_COPY: Record<
  DemoCustomerRouteKey,
  DemoRouteCopy
> = {
  menu: { label: "Menu", desc: "Browse menu" },
  order: { label: "Order", desc: "Place order" },
  review: { label: "Review", desc: "Order review" },
  pay: { label: "Pay", desc: "Checkout" },
  tools: { label: "Guest Tools", desc: "Loyalty & more" },
}

const DEFAULT_STAFF_ROUTE_COPY: Record<
  DemoStaffRouteKey,
  DemoRouteCopy
> = {
  waiter: { label: "Waiter", desc: "Floor service" },
  kitchen: { label: "Kitchen", desc: "Prep queue" },
  bar: { label: "Bar", desc: "Drinks queue" },
  manager: { label: "Manager", desc: "Overview" },
  customize: { label: "Customize", desc: "Branding" },
  features: { label: "Features", desc: "Toggles" },
  admin: { label: "Admin", desc: "System admin" },
}

export const DEFAULT_DEMO_SETUP_CONFIG: DemoSetupConfig = {
  companyName: "Target venue",
  companyType: "Hospitality buyer",
  pitchGoal: "Prove guest flow, live ops, and revenue close in one run.",
  heroTitle: "Demo Control Centre",
  heroSubtitle:
    "Launch any view, run the sales simulator, and frame the walkthrough around the buyer in front of you.",
  spotlightTitle: "Pitch this as an operating system, not a menu widget.",
  spotlightBody:
    "Anchor the story on faster ordering, cleaner service coordination, and a checkout flow that closes revenue without adding staff friction.",
  priorityOne: "Lead with zero-app guest entry and faster basket starts.",
  priorityTwo: "Show live kitchen and bar coordination under service pressure.",
  priorityThree: "Finish on payment completion and measurable operational visibility.",
  passcodesSectionLabel: "Staff Passcodes",
  customerSectionLabel: "Customer Experience",
  staffSectionLabel: "Staff & Operations",
  simulatorSectionLabel: "Sales Simulator",
  customerRoutes: DEFAULT_CUSTOMER_ROUTE_COPY,
  staffRoutes: DEFAULT_STAFF_ROUTE_COPY,
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

function sanitizeRouteMap<TKey extends string>(
  value: unknown,
  defaults: Record<TKey, DemoRouteCopy>
) {
  const input =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const result = {} as Record<TKey, DemoRouteCopy>

  for (const key of Object.keys(defaults) as TKey[]) {
    const routeInput =
      typeof input[key] === "object" && input[key] !== null
        ? (input[key] as Record<string, unknown>)
        : {}
    result[key] = {
      label: sanitizeText(routeInput.label, defaults[key].label, 24),
      desc: sanitizeText(routeInput.desc, defaults[key].desc, 80),
    }
  }

  return result
}

export function cloneDemoSetupConfig(
  value: DemoSetupConfig
): DemoSetupConfig {
  return {
    ...value,
    customerRoutes: {
      ...value.customerRoutes,
    },
    staffRoutes: {
      ...value.staffRoutes,
    },
  }
}

export function sanitizeDemoSetupConfig(
  value: unknown
): DemoSetupConfig {
  const input =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}

  return {
    companyName: sanitizeText(
      input.companyName,
      DEFAULT_DEMO_SETUP_CONFIG.companyName,
      48
    ),
    companyType: sanitizeText(
      input.companyType,
      DEFAULT_DEMO_SETUP_CONFIG.companyType,
      48
    ),
    pitchGoal: sanitizeText(
      input.pitchGoal,
      DEFAULT_DEMO_SETUP_CONFIG.pitchGoal,
      120
    ),
    heroTitle: sanitizeText(
      input.heroTitle,
      DEFAULT_DEMO_SETUP_CONFIG.heroTitle,
      72
    ),
    heroSubtitle: sanitizeText(
      input.heroSubtitle,
      DEFAULT_DEMO_SETUP_CONFIG.heroSubtitle,
      220
    ),
    spotlightTitle: sanitizeText(
      input.spotlightTitle,
      DEFAULT_DEMO_SETUP_CONFIG.spotlightTitle,
      90
    ),
    spotlightBody: sanitizeText(
      input.spotlightBody,
      DEFAULT_DEMO_SETUP_CONFIG.spotlightBody,
      220
    ),
    priorityOne: sanitizeText(
      input.priorityOne,
      DEFAULT_DEMO_SETUP_CONFIG.priorityOne,
      100
    ),
    priorityTwo: sanitizeText(
      input.priorityTwo,
      DEFAULT_DEMO_SETUP_CONFIG.priorityTwo,
      100
    ),
    priorityThree: sanitizeText(
      input.priorityThree,
      DEFAULT_DEMO_SETUP_CONFIG.priorityThree,
      100
    ),
    passcodesSectionLabel: sanitizeText(
      input.passcodesSectionLabel,
      DEFAULT_DEMO_SETUP_CONFIG.passcodesSectionLabel,
      32
    ),
    customerSectionLabel: sanitizeText(
      input.customerSectionLabel,
      DEFAULT_DEMO_SETUP_CONFIG.customerSectionLabel,
      32
    ),
    staffSectionLabel: sanitizeText(
      input.staffSectionLabel,
      DEFAULT_DEMO_SETUP_CONFIG.staffSectionLabel,
      32
    ),
    simulatorSectionLabel: sanitizeText(
      input.simulatorSectionLabel,
      DEFAULT_DEMO_SETUP_CONFIG.simulatorSectionLabel,
      32
    ),
    customerRoutes: sanitizeRouteMap(
      input.customerRoutes,
      DEFAULT_CUSTOMER_ROUTE_COPY
    ),
    staffRoutes: sanitizeRouteMap(
      input.staffRoutes,
      DEFAULT_STAFF_ROUTE_COPY
    ),
  }
}
