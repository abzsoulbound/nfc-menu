import { type ProductOptionGroup } from "@/components/order/ProductDetail"
import {
  hasCustomization,
  type MenuCustomization,
} from "@/lib/menuCustomizations"

type MenuItemOptionSource = {
  optionGroups?: ProductOptionGroup[]
  customization?: MenuCustomization | null
}

export type OptionSelections = Record<string, string[]>

function resolveOptionType(
  value: unknown,
  fallbackMulti: boolean
): ProductOptionGroup["type"] {
  if (value === "single" || value === "multi" || value === "adjustable") {
    return value
  }
  return fallbackMulti ? "multi" : "single"
}

function ingredientLabelFromId(ingredientId: string): string {
  return ingredientId
    .replace(/_/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase())
}

function actionLabelForGroup(group: {
  id: string
  title: string
  type: ProductOptionGroup["type"]
}): string {
  const idTitle = `${group.id} ${group.title}`.toLowerCase()
  if (idTitle.includes("substitute") || group.type === "adjustable") {
    return "Replace"
  }
  if (group.type === "multi") return "Choose"
  return "Select"
}

export function normalizeItemOptionGroups(
  item: MenuItemOptionSource
): ProductOptionGroup[] {
  if (Array.isArray(item.optionGroups) && item.optionGroups.length > 0) {
    return item.optionGroups.map(group => {
      const type = resolveOptionType(group.type, Boolean(group.multiSelect))
      const options = Array.isArray(group.options)
        ? group.options.map(option => ({
            id: String(option.id),
            name: String(option.name),
            priceDelta: Number(option.priceDelta ?? 0),
            sourceGroupId: String(group.id),
            sourceOptionId: String(option.id),
          }))
        : []

      const normalizedOptions =
        type === "adjustable" && options.length > 0
          ? options.some(option => option.name.toLowerCase().includes("normal"))
            ? options
            : [{ id: `${group.id}:normal`, name: "Normal", priceDelta: 0 }, ...options]
          : options

      return {
        id: String(group.id),
        title: String(group.title),
        required: Boolean(group.required),
        multiSelect: type === "multi",
        type,
        min:
          typeof (group as { min?: unknown }).min === "number"
            ? Number((group as { min?: number }).min)
            : undefined,
        max:
          typeof (group as { max?: unknown }).max === "number"
            ? Number((group as { max?: number }).max)
            : undefined,
        actionLabel: actionLabelForGroup({
          id: String(group.id),
          title: String(group.title),
          type,
        }),
        options: normalizedOptions,
      }
    })
  }

  if (!hasCustomization(item.customization)) {
    return []
  }

  const hiddenSystemGroupIds = new Set(["remove_ingredients", "extra_ingredients"])
  const groups = item.customization.groups
  const replacementGroups = groups.filter(group => {
    if (hiddenSystemGroupIds.has(group.id)) {
      return false
    }
    return group.options.some(
      option =>
        (option.removeIngredientIds?.length ?? 0) > 0 &&
        (option.ingredientIds?.length ?? 0) > 0
    )
  })

  const ingredientAdjustables: ProductOptionGroup[] =
    replacementGroups.length > 0
      ? (() => {
          const byIngredient = new Map<
            string,
            {
              title: string
              replaceOptions: Array<{
                id: string
                name: string
                priceDelta: number
                sourceGroupId?: string
                sourceOptionId?: string
              }>
            }
          >()

          for (const group of replacementGroups) {
            for (const option of group.options) {
              const removedIds = option.removeIngredientIds ?? []
              if (removedIds.length === 0) continue

              for (const removedIngredientId of removedIds) {
                const key = removedIngredientId.toLowerCase()
                const existing =
                  byIngredient.get(key) ??
                  {
                    title: ingredientLabelFromId(removedIngredientId),
                    replaceOptions: [],
                  }

                const replaceOption = {
                  id: `${group.id}:${option.id}:replace:${removedIngredientId}`,
                  name: `Replace with ${option.label}`,
                  priceDelta: Number(option.priceDelta ?? 0),
                  sourceGroupId: group.id,
                  sourceOptionId: option.id,
                }

                const dedupeKey = `${replaceOption.sourceGroupId}:${replaceOption.sourceOptionId}`
                if (
                  !existing.replaceOptions.some(
                    value => `${value.sourceGroupId}:${value.sourceOptionId}` === dedupeKey
                  )
                ) {
                  existing.replaceOptions.push(replaceOption)
                }

                byIngredient.set(key, existing)
              }
            }
          }

          return Array.from(byIngredient.entries())
            .map(([key, value]) => {
              const options = [...value.replaceOptions]
              const hasReplace = value.replaceOptions.length > 0

              return {
                id: `ingredient:${key}`,
                title: value.title,
                required: false,
                multiSelect: false,
                type: "adjustable" as const,
                min: 0,
                max: 1,
                actionLabel: hasReplace ? "Replace" : "Select",
                options,
              }
            })
            .filter(group => group.options.length > 0)
        })()
      : []

  const mappedGroups = groups
    .filter(group => !hiddenSystemGroupIds.has(group.id))
    .filter(group => !replacementGroups.some(value => value.id === group.id))
    .map(group => {
      const required =
        (typeof group.min === "number" ? group.min : undefined) !== undefined
          ? Number(group.min) > 0
          : Boolean(group.required)

      const type = group.type

      return {
        id: group.id,
        title: group.name,
        required,
        multiSelect: type === "multi",
        type,
        min: typeof group.min === "number" ? group.min : undefined,
        max: typeof group.max === "number" ? group.max : undefined,
        actionLabel: actionLabelForGroup({
          id: group.id,
          title: group.name,
          type,
        }),
        options: group.options.map(option => ({
          id: option.id,
          name: option.label,
          priceDelta: Number(option.priceDelta ?? 0),
          sourceGroupId: group.id,
          sourceOptionId: option.id,
        })),
      }
    })

  return [...mappedGroups, ...ingredientAdjustables]
}

export function defaultSelectionsFromOptionGroups(
  groups: ProductOptionGroup[]
): OptionSelections {
  const defaults: OptionSelections = {}

  for (const group of groups) {
    if (group.type !== "adjustable") continue
    const normalOption = group.options.find(
      option => option.name.trim().toLowerCase() === "normal"
    )
    if (normalOption) {
      defaults[group.id] = [normalOption.id]
    }
  }

  return defaults
}
