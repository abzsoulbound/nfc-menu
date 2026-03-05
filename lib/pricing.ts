import { ItemEdits } from "@/lib/types"

export function calculateVat(price: number, rate: number) {
  if (rate <= 0) return 0
  return price - price / (1 + rate)
}

export function calculateItemPrice(
  basePrice: number,
  edits?: ItemEdits | null
) {
  if (!edits) return basePrice

  let delta = 0

  if (Array.isArray(edits.addOns)) {
    for (const addOn of edits.addOns) {
      if (!addOn) continue
      if (
        typeof addOn === "object" &&
        typeof addOn.priceDelta === "number"
      ) {
        delta += addOn.priceDelta
      }
    }
  }

  return Math.max(0, basePrice + delta)
}

export function calculateCartTotals(
  items: {
    quantity: number
    unitPrice: number
    vatRate?: number
  }[]
) {
  let subtotal = 0
  let vat = 0

  for (const item of items) {
    const line = item.unitPrice * item.quantity
    subtotal += line
    vat += calculateVat(line, item.vatRate ?? 0)
  }

  return {
    subtotal,
    vat,
    total: subtotal,
  }
}
