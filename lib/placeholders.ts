import type { MenuSection, Station } from "@/lib/types"

export const AI_PLACEHOLDER_HERO_URL =
  "/placeholders/ai-hero-abstract.svg"

export const AI_PLACEHOLDER_SECTION_KITCHEN_URL =
  "/placeholders/ai-section-kitchen.svg"

export const AI_PLACEHOLDER_SECTION_BAR_URL =
  "/placeholders/ai-section-bar.svg"

export const AI_PLACEHOLDER_SECTION_MIXED_URL =
  "/placeholders/ai-section-mixed.svg"

export const AI_PLACEHOLDER_ITEM_FALLBACK_URL =
  "/placeholders/ai-item-failsafe.svg"

function normalizePromptText(input: string) {
  return input.replace(/\s+/g, " ").trim()
}

function hashToSeed(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash % 1_000_000
}

export function getMenuItemAiImageUrl(input: {
  name: string
  description: string
  station?: Station
}) {
  const subject = normalizePromptText(
    `${input.name}. ${input.description}`
  ).slice(0, 260)

  const styleHint =
    input.station === "BAR"
      ? "flat illustration, cafe poster, mint and amber palette"
      : "flat illustration, food poster, terracotta and olive palette"

  const prompt = normalizePromptText(
    `Menu item concept art of ${subject}. Stylized, non-photorealistic, minimal shading, clean background, ${styleHint}, no text, no watermark, no logo.`
  )

  const seed = hashToSeed(
    `${input.station ?? "ANY"}|${input.name}|${input.description}`
  )

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=512&height=512&seed=${seed}&nologo=true&enhance=true`
}

export function getMenuItemPlaceholderUrl() {
  return AI_PLACEHOLDER_ITEM_FALLBACK_URL
}

export function getSectionPlaceholderUrl(
  section: Pick<MenuSection, "items">
) {
  let kitchenCount = 0
  let barCount = 0

  for (const item of section.items) {
    if (item.station === "KITCHEN") kitchenCount += 1
    if (item.station === "BAR") barCount += 1
  }

  if (kitchenCount === 0 && barCount === 0) {
    return AI_PLACEHOLDER_SECTION_MIXED_URL
  }
  if (kitchenCount > 0 && barCount === 0) {
    return AI_PLACEHOLDER_SECTION_KITCHEN_URL
  }
  if (barCount > 0 && kitchenCount === 0) {
    return AI_PLACEHOLDER_SECTION_BAR_URL
  }

  return AI_PLACEHOLDER_SECTION_MIXED_URL
}
