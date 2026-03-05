import { calculateCartTotals } from "@/lib/pricing"
import { Card } from "@/components/ui/Card"

export function CartSummary({
  items,
}: {
  items: {
    quantity: number
    unitPrice: number
    vatRate?: number
  }[]
}) {
  const totals = calculateCartTotals(items)

  return (
    <Card>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>£{totals.total.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  )
}
