import { ItemEdits } from "@/lib/types"

function normalizeChoiceLabel(value: string) {
  return value.replace(/^choice:\s*/i, "").trim()
}

export function describeItemEdits(edits: ItemEdits | null) {
  if (!edits) return []

  const lines: string[] = []

  for (const removal of edits.removals ?? []) {
    const value = removal.trim()
    if (!value) continue
    lines.push(`No ${value}`)
  }

  for (const swap of edits.swaps ?? []) {
    const from = normalizeChoiceLabel(swap.from)
    const to = normalizeChoiceLabel(swap.to)
    if (!to) continue

    if (!from || from.toLowerCase() === to.toLowerCase()) {
      lines.push(`Choice: ${to}`)
      continue
    }

    if (/^(side|sauce|filling\s*\d+|syrup|style)$/i.test(from)) {
      lines.push(`${from}: ${to}`)
      continue
    }

    lines.push(`Swap ${from} -> ${to}`)
  }

  for (const addOn of edits.addOns ?? []) {
    const value = addOn.name.trim()
    if (!value) continue
    lines.push(`Add ${value}`)
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(line)
  }

  return deduped
}
