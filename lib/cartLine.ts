import { ItemEdits } from "@/lib/types"

const CART_LINE_DELIMITER = "::"

function sortUnique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b)
  )
}

function normalizeEditsForKey(edits: ItemEdits | null) {
  if (!edits) return null

  const removals = sortUnique(edits.removals ?? [])
  const swaps = [...(edits.swaps ?? [])]
    .map(swap => ({
      from: swap.from.trim(),
      to: swap.to.trim(),
    }))
    .sort((a, b) =>
      `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)
    )
  const addOns = [...(edits.addOns ?? [])]
    .map(addOn => ({
      name: addOn.name.trim(),
      priceDelta: Number(addOn.priceDelta.toFixed(2)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (removals.length === 0 && swaps.length === 0 && addOns.length === 0) {
    return null
  }

  return {
    removals: removals.length > 0 ? removals : undefined,
    swaps: swaps.length > 0 ? swaps : undefined,
    addOns: addOns.length > 0 ? addOns : undefined,
  }
}

export function buildCartLineId(itemId: string, edits: ItemEdits | null) {
  const normalized = normalizeEditsForKey(edits)
  if (!normalized) return itemId

  const payload = encodeURIComponent(JSON.stringify(normalized))
  return `${itemId}${CART_LINE_DELIMITER}${payload}`
}

export function getMenuItemIdFromCartLineId(lineId: string) {
  const delimiterIndex = lineId.indexOf(CART_LINE_DELIMITER)
  if (delimiterIndex < 0) return lineId
  return lineId.slice(0, delimiterIndex)
}
