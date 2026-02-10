"use client"

import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"

type KitchenItem = {
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
}: {
  tableNumber: number
  items: KitchenItem[]
  onBack: () => void
  onReprint: () => void
  onComplete: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="text-lg font-semibold">
          Kitchen · Table {tableNumber}
        </div>
        <div className="text-sm opacity-70">
          Food preparation ticket
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
