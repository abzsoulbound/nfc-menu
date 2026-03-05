"use client"

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { describeItemEdits } from "@/lib/editsDisplay"
import { ItemEdits } from "@/lib/types"

type KitchenItem = {
  lineId: string
  name: string
  quantity: number
  edits: ItemEdits | null
  prepState?: "SUBMITTED" | "PREPPING"
  compedAt?: string | null
  refireOfLineId?: string | null
}

export function TicketView({
  tableNumber,
  items,
  onBack,
  onReprint,
  onStart,
  onStartLine,
  onReadyLine,
  onVoidLine,
  onRefireLine,
  onComplete,
  canStartPrep,
}: {
  tableNumber: number
  items: KitchenItem[]
  onBack: () => void
  onReprint: () => void
  onStart: () => void
  onStartLine: (lineId: string) => void
  onReadyLine: (lineId: string) => void
  onVoidLine: (lineId: string, reason: string) => void
  onRefireLine: (lineId: string, reason: string) => void
  onComplete: () => void
  canStartPrep: boolean
}) {
  const tableLabel =
    tableNumber === 0 ? "Takeaway" : `Table ${tableNumber}`

  return (
    <div className="space-y-3">
      <Card variant="elevated">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold tracking-tight">
              Kitchen | {tableLabel}
            </div>
            <div className="text-sm text-secondary">
              Food preparation ticket
            </div>
          </div>
          <div className="status-chip status-chip-neutral">
            {items.length} lines
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {items.map(item => {
          const editLines = describeItemEdits(item.edits)

          return (
            <Card key={item.lineId} variant="accent">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">
                      {item.quantity} x {item.name}
                    </div>
                    <div className="text-xs text-secondary">
                      {item.prepState === "PREPPING"
                        ? "In prep"
                        : "Waiting to start"}
                    </div>
                    {editLines.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {editLines.map(line => (
                          <div
                            key={`${item.lineId}-${line}`}
                            className="rounded-[var(--radius-control)] border border-[var(--border)] surface-secondary px-2 py-1 text-xs text-secondary"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {editLines.length > 0 && (
                      <div className="status-chip status-chip-warning">
                        Modified
                      </div>
                    )}
                    <div
                      className={`status-chip ${
                        item.prepState === "PREPPING"
                          ? "status-chip-success"
                          : "status-chip-neutral"
                      }`}
                    >
                      {item.prepState === "PREPPING" ? "Prepping" : "Submitted"}
                    </div>
                    {item.compedAt && (
                      <div className="status-chip status-chip-warning">
                        Comped
                      </div>
                    )}
                    {item.refireOfLineId && (
                      <div className="status-chip status-chip-neutral">
                        Refire
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Button
                    variant="quiet"
                    className="min-h-[40px]"
                    disabled={item.prepState === "PREPPING"}
                    onClick={() => onStartLine(item.lineId)}
                  >
                    Start line
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[40px]"
                    onClick={() => onReadyLine(item.lineId)}
                  >
                    Ready line
                  </Button>
                  <Button
                    variant="danger"
                    className="min-h-[40px]"
                    onClick={() => {
                      const reason = window.prompt(
                        "Void reason"
                      )
                      if (!reason || reason.trim() === "") return
                      onVoidLine(item.lineId, reason.trim())
                    }}
                  >
                    Void line
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-[40px]"
                    onClick={() => {
                      const reason = window.prompt(
                        "Refire reason"
                      )
                      if (!reason || reason.trim() === "") return
                      onRefireLine(item.lineId, reason.trim())
                    }}
                  >
                    Refire
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Button variant="quiet" onClick={onBack} className="min-h-[52px]">
          Back
        </Button>

        <Button
          variant="secondary"
          onClick={onReprint}
          className="min-h-[52px]"
        >
          Reprint
        </Button>

        <Button
          variant="secondary"
          onClick={onStart}
          className="min-h-[52px]"
          disabled={!canStartPrep}
        >
          Start prep
        </Button>

        <Button
          onClick={onComplete}
          className="min-h-[52px]"
        >
          Mark sent
        </Button>
      </div>
    </div>
  )
}
