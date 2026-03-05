import { BrandAssetSlots } from "@/lib/types"

const brandLogoUrl = process.env.NEXT_PUBLIC_BRAND_LOGO_URL?.trim()
const brandHeroUrl = process.env.NEXT_PUBLIC_BRAND_HERO_URL?.trim()

export const BRAND_ASSETS: BrandAssetSlots = {
  logoUrl: brandLogoUrl || undefined,
  heroUrl: brandHeroUrl || undefined,
}

export const BRAND_MONOGRAM = "RD"

export const BRAND_LOCATION = "Restaurant"
