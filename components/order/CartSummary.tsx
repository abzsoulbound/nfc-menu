import { calculateCartTotals } from "@/lib/pricing"
import { Card } from "@/components/ui/Card"

export function CartSummary({
  items,
  tipAmount,
  promoDiscount,
}: {
  items: {
    name?: string
    quantity: number
    unitPrice: number
    vatRate?: number
  }[]
  tipAmount?: number
  promoDiscount?: number
}) {
  const totals = calculateCartTotals(items)
  const tip = tipAmount ?? 0
  const discount = promoDiscount ?? 0
  const grandTotal = totals.total - discount + tip

  return (
    <Card className="receipt-surface shadow-[var(--shadow-elevated)]">
      <div className="space-y-4">
        {/* Receipt Header */}
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
            Order Summary
          </div>
          <div className="mt-0.5 h-px bg-[var(--border-subtle)]" />
        </div>

        {/* Itemised lines */}
        {items.length > 0 && items[0].name && (
          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-base">
                <span className="text-secondary">
                  {item.quantity > 1 && (
                    <span className="mr-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-[var(--surface-accent)] px-1 text-xs font-semibold text-[var(--text-primary)]">
                      {item.quantity}
                    </span>
                  )}
                  {item.name}
                </span>
                <span className="ml-4 shrink-0 font-medium tabular-nums">
                  £{(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-[var(--border-subtle)]" />

        <div className="space-y-2">
          <div className="flex justify-between text-base text-secondary">
            <span>Subtotal</span>
            <span className="tabular-nums">£{totals.subtotal.toFixed(2)}</span>
          </div>

          {totals.vat > 0 && (
            <div className="flex justify-between text-sm text-muted">
              <span>VAT (included)</span>
              <span className="tabular-nums">£{totals.vat.toFixed(2)}</span>
            </div>
          )}

          {discount > 0 && (
            <div className="flex justify-between text-base text-[var(--success-fg)]">
              <span>Discount</span>
              <span className="tabular-nums">-£{discount.toFixed(2)}</span>
            </div>
          )}

          {tip > 0 && (
            <div className="flex justify-between text-base">
              <span className="accent-metal">Tip</span>
              <span className="font-semibold accent-metal tabular-nums tip-count-up">
                £{tip.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="h-px bg-[var(--accent-metal-subtle)]" />

        {/* Grand Total */}
        <div className="flex items-baseline justify-between">
          <span className="display-font text-xl text-[var(--text-heading)]">
            Total
          </span>
          <span className="display-font text-2xl font-bold text-[var(--text-heading)] tabular-nums">
            £{grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  )
}
