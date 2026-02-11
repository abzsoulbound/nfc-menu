"use client"

import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"

type BarItem = {
  orderItemId?: string
  name: string
  quantity: number
  edits: any
}

export function TicketView({
  tableNumber,
  items,
  onBack,
  onReprint,
  onComplete,
  onCompleteItem,
}: {
  tableNumber: number
  items: BarItem[]
  onBack: () => void
  onReprint: () => void
  onComplete: () => void
  onCompleteItem?: (orderItemId: string) => void
}) {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="text-lg font-semibold">
          Bar · Table {tableNumber}
        </div>
        <div className="text-sm opacity-70">
          Drink preparation ticket
        </div>
      </Card>

      <Divider />

      <div className="space-y-2">
        {items.map((item, i) => (
          <Card key={i}>
            <div className="flex justify-between">
              <div>
                <div className="font-medium">
                  {item.quantity}× {item.name}
                </div>
                {item.edits && (
                  <div className="text-xs opacity-60">
                    modified
                  </div>
                )}
              </div>

              {item.orderItemId && onCompleteItem && (
                <Button
                  variant="secondary"
                  onClick={() => onCompleteItem(item.orderItemId!)}
                >
                  Done
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Divider />

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>

        <Button variant="secondary" onClick={onReprint}>
          Reprint
        </Button>

        <Button onClick={onComplete}>
          Mark sent
        </Button>
      </div>
    </div>
  )
}
