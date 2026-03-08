import { ReactNode } from "react"
import { AllergenList } from "@/components/menu/AllergenList"
import { Card } from "@/components/ui/Card"
import { FeatureGate } from "@/components/ui/FeatureGate"
import {
  getMenuItemAiImageUrl,
  getMenuItemPlaceholderUrl,
} from "@/lib/placeholders"
import { isCustomerMinimalModeEnabled } from "@/lib/customerMode"
import { EditableOptions, Station } from "@/lib/types"

function formatOptionLines(options: EditableOptions | undefined) {
  if (!options) return []

  const lines: string[] = []

  if ((options.removals ?? []).length > 0) {
    lines.push(`Remove: ${options.removals!.join(", ")}`)
  }

  const swapsByFrom = new Map<string, string[]>()
  for (const swap of options.swaps ?? []) {
    const current = swapsByFrom.get(swap.from) ?? [swap.from]
    if (!current.includes(swap.to)) {
      current.push(swap.to)
    }
    swapsByFrom.set(swap.from, current)
  }

  for (const [from, choices] of swapsByFrom.entries()) {
    lines.push(`Swap ${from}: ${choices.join(" / ")}`)
  }

  if ((options.addOns ?? []).length > 0) {
    const addOnsText = options.addOns!
      .map(addOn => `${addOn.name} (+£${addOn.priceDelta.toFixed(2)})`)
      .join(", ")
    lines.push(`Add-ons: ${addOnsText}`)
  }

  return lines
}

export function MenuItemCard({
  name,
  description,
  image,
  price,
  vatRate,
  allergens,
  station,
  editableOptions,
  variant = "menu",
  children,
  readOnly = false,
  actionPlacement = "bottom",
}: {
  name: string
  description: string
  image?: string | null
  price: number
  vatRate: number
  allergens: string[]
  station?: Station
  editableOptions?: EditableOptions
  variant?: "menu" | "order" | "staff"
  children?: ReactNode
  readOnly?: boolean
  actionPlacement?: "bottom" | "underPrice"
}) {
  const stationTone = station === "BAR"
    ? "status-chip status-chip-warning"
    : "status-chip status-chip-success"

  const variantCardClass: Record<"menu" | "order" | "staff", string> = {
    menu: "surface-elevated shadow-[var(--shadow-elevated)] card-gradient",
    order: "surface-secondary",
    staff: "surface-secondary",
  }

  const variantPriceClass: Record<"menu" | "order" | "staff", string> = {
    menu: "surface-accent",
    order: "surface-accent",
    staff: "surface-accent",
  }

  const showVatDetails = variant === "staff"
  const customerMinimalMode = isCustomerMinimalModeEnabled()
  const showStationBadge = variant === "staff"
  const collapsibleAllergens = variant !== "staff"
  const vatPercent = Number((vatRate * 100).toFixed(1))
  const optionLines = formatOptionLines(editableOptions)
  const showOptionLines = variant === "staff" && optionLines.length > 0
  const explicitImageUrl = typeof image === "string" ? image.trim() : ""
  const hasExplicitImage = explicitImageUrl !== ""
  const staticFallbackImageUrl = getMenuItemPlaceholderUrl()
  const aiGeneratedImageUrl = hasExplicitImage
    ? null
    : getMenuItemAiImageUrl({
        name,
        description,
        station,
      })
  const showAiBadge =
    !!aiGeneratedImageUrl &&
    (variant === "staff" || !customerMinimalMode)

  const primaryImageUrl = hasExplicitImage
    ? explicitImageUrl
    : aiGeneratedImageUrl ?? staticFallbackImageUrl
  const backgroundImage = `url("${primaryImageUrl}"), url("${staticFallbackImageUrl}")`
  const showInlineActions =
    !readOnly && actionPlacement === "underPrice" && !!children
  const showBottomActions = !readOnly && !showInlineActions

  return (
    <Card className={variantCardClass[variant]}>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="flex gap-4">
            <div
              aria-label={`${name} image`}
              className="relative mt-0.5 h-16 w-16 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-cover bg-center shadow-[0_1px_4px_rgba(66,44,20,0.1)]"
              style={{ backgroundImage }}
            >
              {showAiBadge && (
                <span className="absolute bottom-0 right-0 rounded-tl-md border-l border-t border-[var(--border)] bg-[rgba(0,0,0,0.62)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-white">
                  AI
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="item-name-font text-xl text-[var(--text-heading)]">
                  {name}
                </div>

                {showStationBadge && station && (
                  <span className={`${stationTone} text-[11px] uppercase tracking-[0.2em]`}>
                    {station}
                  </span>
                )}
              </div>

              <div className="text-base leading-relaxed text-secondary">
                {description}
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:flex-col sm:items-end">
            <div className={`h-fit rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-right ${variantPriceClass[variant]}`}>
              <div className="text-base font-semibold accent-metal">
                £{price.toFixed(2)}
              </div>
              {showVatDetails && (
                <div className="text-[11px] text-secondary">
                  VAT included {vatPercent}%
                </div>
              )}
            </div>

            {showInlineActions && (
              <div className="w-full sm:w-auto">
                {children}
              </div>
            )}
          </div>
        </div>

        <FeatureGate feature="allergenDisplay">
          <AllergenList
            allergens={allergens}
            collapsible={collapsibleAllergens}
          />
        </FeatureGate>

        {showOptionLines && (
          <div className="rounded-lg border border-[var(--border-subtle)] surface-accent px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Options
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-secondary">
              {optionLines.map(line => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {showBottomActions && (
          <div className="pt-1">
            {children}
          </div>
        )}
      </div>
    </Card>
  )
}
