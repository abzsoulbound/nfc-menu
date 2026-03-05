"use client"

import { KeyboardEvent, MouseEvent, useRef } from "react"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { queueUrgencyFromMinutes, queueUrgencyLabel } from "@/lib/ui"

type KitchenItem = {
  name: string
  quantity: number
  prepState?: "SUBMITTED" | "PREPPING"
}

type KitchenQueueTable = {
  tableNumber: number
  items: KitchenItem[]
  submittedAt: string
}

function minutesSince(ts: string) {
  return Math.floor(
    (Date.now() - new Date(ts).getTime()) / 60000
  )
}

function tableLabel(tableNumber: number) {
  return tableNumber === 0 ? "Takeaway" : `Table ${tableNumber}`
}

export function StationQueue({
  tables,
  activeTable,
  onSelect,
  onReprint,
}: {
  tables: KitchenQueueTable[]
  activeTable?: number | null
  onSelect: (tableNumber: number) => void
  onReprint: (tableNumber: number) => void
}) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const holdTriggeredRef = useRef(false)

  function clearHoldTimer() {
    if (!holdTimerRef.current) return
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  function startLongPress(tableNumber: number) {
    holdTriggeredRef.current = false
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      holdTriggeredRef.current = true
      onReprint(tableNumber)
    }, 650)
  }

  function finishPress(tableNumber: number) {
    if (!holdTriggeredRef.current) {
      onSelect(tableNumber)
    }
    holdTriggeredRef.current = false
    clearHoldTimer()
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    tableNumber: number
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(tableNumber)
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault()
      onReprint(tableNumber)
    }
  }

  return (
    <div className="space-y-2">
      {tables.map(table => {
        const age = minutesSince(table.submittedAt)
        const urgency = queueUrgencyFromMinutes(age)
        const preppingCount = table.items.filter(
          item => item.prepState === "PREPPING"
        ).length

        return (
          <Card
            key={table.tableNumber}
            variant="accent"
            className={`cursor-pointer transition-all ${
              activeTable === table.tableNumber
                ? "ring-2 ring-[var(--accent-action)]"
                : ""
            }`}
            role="button"
            tabIndex={0}
            aria-label={`${tableLabel(table.tableNumber)} queue ticket`}
            onPointerDown={event => {
              if (event.button !== 0) return
              startLongPress(table.tableNumber)
            }}
            onPointerUp={event => {
              if (event.button !== 0) return
              finishPress(table.tableNumber)
            }}
            onPointerLeave={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) =>
              handleKeyDown(event, table.tableNumber)
            }
            onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
              e.preventDefault()
              onReprint(table.tableNumber)
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-lg font-semibold">
                  {tableLabel(table.tableNumber)}
                </div>
                <div className="text-sm text-secondary">
                  {table.items.length} kitchen line(s)
                  {preppingCount > 0
                    ? ` | ${preppingCount} prepping`
                    : ""}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={
                    urgency === "critical"
                      ? "danger"
                      : urgency === "watch"
                      ? "warning"
                      : "success"
                  }
                >
                  {queueUrgencyLabel(urgency)}
                </Badge>
                <div className="text-xs text-secondary">{age}m</div>
              </div>
            </div>
          </Card>
        )
      })}

      {tables.length === 0 && (
        <div className="py-8 text-center text-sm text-secondary">
          No kitchen items waiting.
        </div>
      )}
    </div>
  )
}
