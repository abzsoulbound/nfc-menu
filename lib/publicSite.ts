export const PUBLIC_SITE_LINKS = [
  { href: "/", label: "Company" },
  { href: "/sales-demo", label: "Live Demo" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
  { href: "/refunds", label: "Refunds" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const

export const PUBLIC_SITE_NAME = "Soulbound Studio"

export const PUBLIC_SITE_MONOGRAM = "SB"

export const PUBLIC_SITE_SERVICE_AREA =
  process.env.NEXT_PUBLIC_SERVICE_REGION?.trim() || "United Kingdom and remote"

export const PUBLIC_SITE_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
  "Set NEXT_PUBLIC_SUPPORT_EMAIL"

export const PUBLIC_SITE_SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
  "Set NEXT_PUBLIC_SUPPORT_PHONE"

export const PUBLIC_SITE_SUPPORT_HOURS =
  process.env.NEXT_PUBLIC_SUPPORT_HOURS?.trim() || "Mon-Fri, 09:00-17:00 GMT"

export const PUBLIC_SITE_SUMMARY =
  "Soulbound Studio builds branded digital products, tactile guest journeys, and operational systems for hospitality-led businesses."

export const PUBLIC_SITE_HEADER_HINT =
  "Creative technology for hospitality, guest experience, and operations."

export const PUBLIC_SITE_AUDIENCE =
  "Built for founders, operators, and venue teams that need software with a stronger point of view."

export const PUBLIC_SITE_LAST_UPDATED = "4 March 2026"

const PUBLIC_SITE_PATHS = new Set([
  "/",
  "/company",
  "/sales-demo",
  "/contact",
  "/pricing",
  "/refunds",
  "/terms",
  "/privacy",
])

export function isPublicSitePath(pathname: string) {
  const path = (pathname.split("?")[0] || "/").trim() || "/"
  return PUBLIC_SITE_PATHS.has(path)
}
