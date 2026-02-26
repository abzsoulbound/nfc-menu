import { ReactNode } from "react"
import { AllergenList } from "@/components/menu/AllergenList"
import { Card } from "@/components/ui/Card"
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
}) {
  const stationTone = station === "BAR"
    ? "status-chip status-chip-warning"
    : "status-chip status-chip-success"

  const variantCardClass: Record<"menu" | "order" | "staff", string> = {
    menu: "surface-elevated shadow-[var(--shadow-soft)]",
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

  return (
    <Card className={variantCardClass[variant]}>
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex gap-3">
            <div
              aria-label={`${name} image`}
              className="relative mt-0.5 h-14 w-14 overflow-hidden rounded-lg border border-[var(--border)] bg-cover bg-center"
              style={{ backgroundImage }}
            >
              {showAiBadge && (
                <span className="absolute bottom-0 right-0 rounded-tl-md border-l border-t border-[var(--border)] bg-[rgba(0,0,0,0.62)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-white">
                  AI
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-[var(--text-primary)]">
                  {name}
                </div>

                {showStationBadge && station && (
                  <span className={`${stationTone} text-[10px] uppercase tracking-[0.2em]`}>
                    {station}
                  </span>
                )}
              </div>

              <div className="text-sm leading-relaxed text-secondary">
                {description}
              </div>
            </div>
          </div>

          <div className={`h-fit rounded-xl border border-[var(--border)] px-3 py-1.5 text-right ${variantPriceClass[variant]}`}>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              £{price.toFixed(2)}
            </div>
            {showVatDetails && (
              <div className="text-[11px] text-secondary">
                VAT included {vatPercent}%
              </div>
            )}
          </div>
        </div>

        <AllergenList
          allergens={allergens}
          collapsible={collapsibleAllergens}
        />

        {optionLines.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] surface-accent px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Options
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-secondary">
              {optionLines.map(line => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="pt-1">
            {children}
          </div>
        )}
      </div>
    </Card>
  )
}
