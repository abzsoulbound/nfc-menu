import { BrandAssetSlots } from "@/lib/types"

export const BRAND_ASSETS: BrandAssetSlots = {
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || undefined,
  heroUrl: process.env.NEXT_PUBLIC_BRAND_HERO_URL || undefined,
}

export const BRAND_MONOGRAM = "FS"

export const BRAND_LOCATION = "Loughton, Essex"
