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
          className={`focus-ring action-surface action-card action-card-left w-full transition-all ${
            selectedTagId === tag.id
              ? ""
              : "action-surface-muted"
          }`}
          onClick={() => onSelect(tag)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="mono-font text-sm font-semibold">
                {tag.id}
              </div>
              <div className="action-subtle-text text-xs">
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
