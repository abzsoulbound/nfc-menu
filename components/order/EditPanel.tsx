import { Card } from "@/components/ui/Card"
import { ItemEdits } from "@/lib/types"

type EditableItem = {
  editableOptions?: {
    removals?: string[]
    swaps?: { from: string; to: string }[]
    addOns?: { name: string; priceDelta: number }[]
  }
}

function applySwapChoice(
  current: ItemEdits,
  from: string,
  to: string
) {
  const swaps = (current.swaps ?? []).filter(s => s.from !== from)
  if (to !== from) {
    swaps.push({ from, to })
  }
  return {
    ...current,
    swaps,
  }
}

export function EditPanel({
  item,
  value,
  onChange,
}: {
  item: EditableItem
  value: ItemEdits | null | undefined
  onChange: (edits: ItemEdits) => void
}) {
  const edits: ItemEdits = value ?? {}
  const swapGroups = new Map<string, string[]>()

  for (const option of item.editableOptions?.swaps ?? []) {
    const existing = swapGroups.get(option.from) ?? [option.from]
    if (!existing.includes(option.to)) existing.push(option.to)
    swapGroups.set(option.from, existing)
  }

  return (
    <Card variant="accent">
      <div className="space-y-3 text-sm">
        {(item.editableOptions?.removals ?? []).map(removal => (
          <label
            key={removal}
            className="flex items-center gap-2"
          >
            <input
              type="checkbox"
              checked={edits.removals?.includes(removal) ?? false}
              onChange={e => {
                const next = e.target.checked
                  ? [...(edits.removals ?? []), removal]
                  : (edits.removals ?? []).filter(
                      x => x !== removal
                    )

                onChange({ ...edits, removals: next })
              }}
            />
            Remove {removal}
          </label>
        ))}

        {Array.from(swapGroups.entries()).map(([from, options]) => {
          const selected =
            edits.swaps?.find(s => s.from === from)?.to ?? from

          return (
            <label
              key={from}
              className="flex items-center gap-2"
            >
              <span className="text-secondary">Swap {from}</span>
              <select
                className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-1"
                value={selected}
                onChange={e =>
                  onChange(
                    applySwapChoice(edits, from, e.target.value)
                  )
                }
              >
                {options.map(option => (
                  <option key={`${from}-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )
        })}

        {(item.editableOptions?.addOns ?? []).map(addOn => {
          const checked =
            edits.addOns?.some(
              selected => selected.name === addOn.name
            ) ?? false

          return (
            <label
              key={addOn.name}
              className="flex items-center gap-2"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => {
                  const next = e.target.checked
                    ? [...(edits.addOns ?? []), addOn]
                    : (edits.addOns ?? []).filter(
                        x => x.name !== addOn.name
                      )

                  onChange({ ...edits, addOns: next })
                }}
              />
              Add {addOn.name} (+£{addOn.priceDelta.toFixed(2)})
            </label>
          )
        })}
      </div>
    </Card>
  )
}
