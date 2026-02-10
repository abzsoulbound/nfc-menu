import { Card } from "@/components/ui/Card"
import { AllergenList } from "@/components/menu/AllergenList"

export function CartLineItem({
  name,
  quantity,
  unitPrice,
  edits,
  allergens,
}: {
  name: string
  quantity: number
  unitPrice: number
  edits: any
  allergens: string[]
}) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="font-medium">
            {quantity}× {name}
          </div>

          {edits && (
            <div className="text-xs opacity-60">
              modified
            </div>
          )}

          <AllergenList allergens={allergens} />
        </div>

        <div className="text-sm">
          £{(unitPrice * quantity).toFixed(2)}
        </div>
      </div>
    </Card>
  )
}