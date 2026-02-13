"use client"

import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { formatTableNumber } from "@/lib/tableCatalog"

export function TagList({
  tags,
  onSelect,
}: {
  tags: {
    id: string
    tableNumber: number | null
    activeSessionCount: number
    active: boolean
    lastSeenAt: string
  }[]
  onSelect: (tag: any) => void
}) {
  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  return (
    <div className="space-y-2">
      {tags.map(tag => (
        <Card
          key={tag.id}
          className="cursor-pointer"
          onClick={() => onSelect(tag)}
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="font-mono text-sm">
                {tag.id}
              </div>
              <div className="text-xs opacity-60">
                Table:{" "}
                {tag.tableNumber === null
                  ? "—"
                  : formatTableNumber(tag.tableNumber)}{" "}
                · Sessions:{" "}
                {tag.activeSessionCount}
              </div>
            </div>

            <div className="flex gap-2">
              {!tag.active && <Badge>inactive</Badge>}
              <Badge>
                {minutesSince(tag.lastSeenAt)}m
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
