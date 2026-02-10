import { Card } from "@/components/ui/Card"

export function EditPanel({
  item,
  value,
  onChange,
}: {
  item: {
    editableOptions: {
      removals?: string[]
      swaps?: { from: string; to: string }[]
      addOns?: { name: string; priceDelta: number }[]
    }
  }
  value: any
  onChange: (edits: any) => void
}) {
  const edits = value ?? {}

  return (
    <Card>
      <div className="space-y-2 text-sm">
        {item.editableOptions?.removals?.map(r => (
          <label key={r} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={edits.removals?.includes(r)}
              onChange={e => {
                const next = e.target.checked
                  ? [...(edits.removals ?? []), r]
                  : (edits.removals ?? []).filter(
                      (x: string) => x !== r
                    )

                onChange({ ...edits, removals: next })
              }}
            />
            Remove {r}
          </label>
        ))}

        {item.editableOptions?.addOns?.map(a => (
          <label key={a.name} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={edits.addOns?.includes(a.name)}
              onChange={e => {
                const next = e.target.checked
                  ? [...(edits.addOns ?? []), a.name]
                  : (edits.addOns ?? []).filter(
                      (x: string) => x !== a.name
                    )

                onChange({ ...edits, addOns: next })
              }}
            />
            Add {a.name}
          </label>
        ))}
      </div>
    </Card>
  )
}