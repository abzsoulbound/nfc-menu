export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "eggs"
  | "soy"
  | "fish"
  | "shellfish"
  | "sesame"
  | "mustard"
  | "celery"
  | "sulphites"
  | "lupin"

export type AllergenSource = {
  base: Allergen[]
  removals?: Record<string, Allergen[]>
  swaps?: Record<string, Allergen[]>
  addOns?: Record<string, Allergen[]>
}

export type ItemEdits = {
  removals?: string[]
  swaps?: { from: string; to: string }[]
  addOns?: (string | { name: string })[]
}

export function resolveAllergens(
  baseAllergens: Allergen[],
  edits: ItemEdits | null,
  sources: AllergenSource
) {
  let active = new Set<Allergen>(baseAllergens)

  if (edits?.removals) {
    for (const r of edits.removals) {
      const removed = sources.removals?.[r]
      if (removed) {
        for (const a of removed) active.delete(a)
      }
    }
  }

  if (edits?.swaps) {
    for (const s of edits.swaps) {
      const added = sources.swaps?.[s.to]
      if (added) {
        for (const a of added) active.add(a)
      }
    }
  }

  if (edits?.addOns) {
    for (const addOn of edits.addOns) {
      const key =
        typeof addOn === "string" ? addOn : addOn.name
      const added = sources.addOns?.[key]
      if (added) {
        for (const x of added) active.add(x)
      }
    }
  }

  return Array.from(active)
}

export function detectIntroducedAllergens(
  base: Allergen[],
  resolved: Allergen[]
) {
  const baseSet = new Set(base)
  return resolved.filter(a => !baseSet.has(a))
}

export function hasNewAllergens(
  base: Allergen[],
  resolved: Allergen[]
) {
  return detectIntroducedAllergens(base, resolved).length > 0
}
