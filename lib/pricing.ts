export function calculateVat(price: number, rate: number) {
  return price * rate
}

export function calculateItemPrice(
  basePrice: number,
  edits?: any
) {
  if (!edits) return basePrice

  let delta = 0

  if (typeof edits.priceDelta === "number") {
    delta += edits.priceDelta
  }

  if (typeof edits.addOnPriceDelta === "number") {
    delta += edits.addOnPriceDelta
  }

  if (Array.isArray(edits.addOns)) {
    for (const addOn of edits.addOns) {
      if (
        addOn &&
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
  items: { quantity: number; unitPrice: number; vatRate?: number }[]
) {
  let subtotal = 0
  let vat = 0

  for (const i of items) {
    subtotal += i.unitPrice * i.quantity
    vat += calculateVat(
      i.unitPrice * i.quantity,
      i.vatRate ?? 0
    )
  }

  return {
    subtotal,
    vat,
    total: subtotal + vat,
  }
}
