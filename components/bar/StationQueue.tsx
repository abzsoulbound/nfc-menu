"use client"

import { MouseEvent } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"

type BarItem = {
  name: string
  quantity: number
}

type BarQueueTable = {
  tableNumber: number
  items: BarItem[]
  submittedAt: string
}

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

export function StationQueue({
  tables,
  onSelect,
  onReprint,
}: {
  tables: BarQueueTable[]
  onSelect: (tableNumber: number) => void
  onReprint: (tableNumber: number) => void
}) {
  return (
    <div className="space-y-3">
      {tables.map(table => (
        <Card
          key={table.tableNumber}
          className="cursor-pointer"
          onClick={() => onSelect(table.tableNumber)}
          onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
            e.preventDefault()
            onReprint(table.tableNumber)
          }}
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                Table {table.tableNumber}
              </div>
              <div className="text-sm opacity-70">
                {table.items.length} drink item(s)
              </div>
            </div>

            <Badge>
              {minutesSince(table.submittedAt)}m
            </Badge>
          </div>
        </Card>
      ))}

      {tables.length === 0 && (
        <div className="opacity-60 text-center">
          No bar items waiting
        </div>
      )}
    </div>
  )
}
