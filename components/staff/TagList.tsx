"use client"

import { Badge } from "@/components/ui/Badge"
import { TagDTO } from "@/lib/types"

export function TagList({
  tags,
  onSelect,
  selectedTagId,
}: {
  tags: TagDTO[]
  onSelect: (tag: TagDTO) => void
  selectedTagId?: string | null
}) {
  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  return (
    <div className="space-y-2">
      {tags.map(tag => (
        <button
          key={tag.id}
          type="button"
          className={`focus-ring w-full rounded-[var(--radius-control)] border border-[var(--border)] p-3 text-left transition-all ${
            selectedTagId === tag.id
              ? "surface-accent"
              : "surface-secondary"
          }`}
          onClick={() => onSelect(tag)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="mono-font text-sm font-semibold">
                {tag.id}
              </div>
              <div className="text-xs text-secondary">
                Table: {tag.tableNumber ?? "-"} | Sessions:{" "}
                {tag.activeSessionCount}
              </div>
            </div>

            <div className="flex gap-1">
              {!tag.active && <Badge variant="warning">Inactive</Badge>}
              <Badge variant="neutral">
                {minutesSince(tag.lastSeenAt)}m
              </Badge>
            </div>
          </div>
        </button>
      ))}

      {tags.length === 0 && (
        <div className="py-8 text-center text-sm text-secondary">
          No active NFC tags.
        </div>
      )}
    </div>
  )
}
