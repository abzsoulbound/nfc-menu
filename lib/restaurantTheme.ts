import type { CustomerThemeConfig, UiMode } from "@/lib/types"

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseHex(hex: string) {
  const normalized = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 0, g: 0, b: 0 }
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function toHex(input: { r: number; g: number; b: number }) {
  const r = clampColor(input.r).toString(16).padStart(2, "0")
  const g = clampColor(input.g).toString(16).padStart(2, "0")
  const b = clampColor(input.b).toString(16).padStart(2, "0")
  return `#${r}${g}${b}`.toUpperCase()
}

function shift(hex: string, amount: number) {
  const parsed = parseHex(hex)
  return toHex({
    r: parsed.r + amount,
    g: parsed.g + amount,
    b: parsed.b + amount,
  })
}

function mixHex(hexA: string, hexB: string, ratio: number) {
  const a = parseHex(hexA)
  const b = parseHex(hexB)
  const safeRatio = Math.max(0, Math.min(1, ratio))
  return toHex({
    r: a.r + (b.r - a.r) * safeRatio,
    g: a.g + (b.g - a.g) * safeRatio,
    b: a.b + (b.b - a.b) * safeRatio,
  })
}

function radiusVars(radiusPreset: CustomerThemeConfig["radiusPreset"]) {
  if (radiusPreset === "ROUND") {
    return {
      card: "26px",
      control: "16px",
    }
  }
  if (radiusPreset === "SHARP") {
    return {
      card: "10px",
      control: "8px",
    }
  }
  return {
    card: "20px",
    control: "12px",
  }
}

function fontVar(fontPreset: CustomerThemeConfig["fontPreset"]) {
  if (fontPreset === "SERIF") {
    return "var(--font-display), Georgia, serif"
  }
  if (fontPreset === "MONO") {
    return "var(--font-mono), ui-monospace, monospace"
  }
  return "var(--font-ui), system-ui, sans-serif"
}

export function buildThemeVars(input: {
  theme: CustomerThemeConfig
  uiMode: UiMode
}) {
  const { theme, uiMode } = input
  const radii = radiusVars(theme.radiusPreset)
  const vars: Record<string, string> = {
    "--font-ui-dynamic": fontVar(theme.fontPreset),
    "--radius-card": radii.card,
    "--radius-control": radii.control,
  }

  if (uiMode === "customer") {
    vars["--bg-primary"] = shift(theme.customerSurface, -10)
    vars["--bg-secondary"] = shift(theme.customerSurface, 6)
    vars["--surface-primary"] = theme.customerSurface
    vars["--surface-secondary"] = shift(theme.customerSurface, 8)
    vars["--surface-accent"] = shift(theme.customerSurface, 16)
    vars["--surface-elevated"] = shift(theme.customerSurface, 20)
    vars["--text-primary"] = theme.customerText
    vars["--text-secondary"] = mixHex(theme.customerText, "#FFFFFF", 0.35)
    vars["--text-muted"] = mixHex(theme.customerText, "#FFFFFF", 0.5)
    vars["--accent-action"] = theme.customerPrimary
    vars["--accent-action-strong"] = shift(theme.customerPrimary, -24)
    vars["--focus"] = theme.customerFocus
    vars["--border"] = mixHex(theme.customerPrimary, theme.customerSurface, 0.6)
  } else {
    vars["--accent-action"] = theme.staffPrimary
    vars["--accent-action-strong"] = shift(theme.staffPrimary, -18)
    vars["--focus"] = shift(theme.staffPrimary, 12)
  }

  return vars
}
