import { AllergenList } from "@/components/menu/AllergenList"
import { Card } from "@/components/ui/Card"
import { FeatureGate } from "@/components/ui/FeatureGate"

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
  edits: Record<string, unknown> | null
  allergens: string[]
}) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="font-medium">
            {quantity} x {name}
          </div>

          {edits !== null && (
            <div className="text-xs opacity-60">
              modified
            </div>
          )}

          <FeatureGate feature="allergenDisplay">
            <AllergenList allergens={allergens} />
          </FeatureGate>
        </div>

        <div className="text-sm">
          £{(unitPrice * quantity).toFixed(2)}
        </div>
      </div>
    </Card>
  )
}
