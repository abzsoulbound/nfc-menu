"use client"

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"

export function TableAssignment({
  tableId,
  tableNumber,
  tags,
  allTags,
  onChange,
}: {
  tableId: string
  tableNumber: number
  tags: { id: string }[]
  allTags: { id: string; tableNumber: number | null }[]
  onChange: () => void | Promise<void>
}) {
  async function assign(tagId: string) {
    await fetchJson("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId,
        tableId,
      }),
    })
    await onChange()
  }

  async function unassign(tagId: string) {
    await fetchJson("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId,
        tableId: null,
      }),
    })
    await onChange()
  }

  const availableTags = allTags.filter(
    t => t.tableNumber === null
  )

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card variant="accent" className="space-y-2">
        <div className="text-sm font-semibold tracking-tight">
          Assigned tags | Table {tableNumber}
        </div>

        {tags.length === 0 && (
          <div className="text-sm text-secondary">
            No tags assigned.
          </div>
        )}

        {tags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-3 py-2"
          >
            <div className="mono-font text-sm">{tag.id}</div>
            <Button
              variant="ghost"
              className="min-h-[36px] px-3"
              onClick={() => unassign(tag.id).catch(() => {})}
            >
              Unassign
            </Button>
          </div>
        ))}
      </Card>

      <Card variant="accent" className="space-y-2">
        <div className="text-sm font-semibold tracking-tight">
          Assign new tag
        </div>

        {availableTags.length === 0 && (
          <div className="text-sm text-secondary">
            No unassigned tags available.
          </div>
        )}

        {availableTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            className="focus-ring action-surface flex w-full items-center justify-between rounded-[var(--radius-control)] border px-3 py-2 text-left"
            onClick={() => assign(tag.id).catch(() => {})}
          >
            <span className="mono-font text-sm">{tag.id}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">
              Assign
            </span>
          </button>
        ))}
      </Card>
    </div>
  )
}
