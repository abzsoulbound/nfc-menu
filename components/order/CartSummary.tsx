import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { calculateCartTotals } from "@/lib/pricing"

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
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>£{totals.subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between opacity-70">
          <span>VAT</span>
          <span>£{totals.vat.toFixed(2)}</span>
        </div>

        <Divider />

        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>£{totals.total.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  )
}