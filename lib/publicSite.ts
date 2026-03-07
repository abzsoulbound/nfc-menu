export const PUBLIC_SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#projects", label: "Projects" },
  { href: "/demo", label: "NFC Menu Demo" },
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
  "Soulbound Studio is a creative technology studio that designs and ships full-stack software — from hospitality platforms and operational tools to consumer-facing products."

export const PUBLIC_SITE_HEADER_HINT =
  "Creative technology studio — building products people actually use."

export const PUBLIC_SITE_AUDIENCE =
  "Built for anyone who wants to see what we're working on — founders, collaborators, and the curious."

export const PUBLIC_SITE_LAST_UPDATED = "7 March 2026"

const PUBLIC_SITE_PATHS = new Set([
  "/",
  "/company",
  "/demo",
  "/demo-setup",
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
