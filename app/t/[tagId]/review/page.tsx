"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { Divider } from "@/components/ui/Divider"
import { Button } from "@/components/ui/Button"
import { Toast } from "@/components/ui/Toast"
import { Modal } from "@/components/ui/Modal"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"
import { calculateCartTotals } from "@/lib/pricing"

type ReviewItem = {
  id: string
  name: string
  quantity: number
  edits: any
  allergens: string[]
  unitPrice: number
  station: "KITCHEN" | "BAR"
}

export default function PerUserReviewPage({
  params,
}: {
  params: { tagId: string }
}) {
  const router = useRouter()
  const tagId = params.tagId

  const { sessionId } = useSessionStore()
  const {
    items,
    clearSubmittedItems,
  } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const cartItems: ReviewItem[] = items
  const totals = calculateCartTotals(cartItems)

  async function submit() {
    if (!sessionId || cartItems.length === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          tagId,
          items: cartItems.map(i => ({
            itemId: i.id,
            name: i.name,
            quantity: i.quantity,
            edits: i.edits,
            allergens: i.allergens,
            unitPrice: i.unitPrice,
            station: i.station,
          })),
        }),
      })

      if (!res.ok) {
        const msg = await res.json()
        throw new Error(msg.error ?? "Submission failed")
      }

      clearSubmittedItems()
      router.push(`/t/${tagId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="p-4 opacity-60 text-center">
        No items to review
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {error && <Toast>{error}</Toast>}

      <Card>
        <div className="text-lg font-semibold">
          Review your items
        </div>
        <div className="text-sm opacity-70">
          Only your items will be added to the table
        </div>
      </Card>

      <Divider />

      <div className="space-y-3">
        {cartItems.map(item => (
          <Card key={item.id}>
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

                {item.allergens.length > 0 && (
                  <div className="text-xs opacity-60">
                    Allergens: {item.allergens.join(", ")}
                  </div>
                )}
              </div>

              <div className="text-sm">
                £{(item.unitPrice * item.quantity).toFixed(2)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Divider />

      <Card>
        <div className="flex justify-between text-sm">
          <div>Subtotal</div>
          <div>£{totals.subtotal.toFixed(2)}</div>
        </div>
        <div className="flex justify-between text-sm opacity-70">
          <div>VAT</div>
          <div>£{totals.vat.toFixed(2)}</div>
        </div>
        <Divider />
        <div className="flex justify-between font-semibold">
          <div>Total</div>
          <div>£{totals.total.toFixed(2)}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push(`/t/${tagId}`)}
          disabled={submitting}
        >
          Back
        </Button>

        <Button
          onClick={() => setShowConfirm(true)}
          disabled={submitting}
        >
          Add to table
        </Button>
      </div>

      {showConfirm && (
        <Modal
          title="Confirm add to table"
          onCancel={() => setShowConfirm(false)}
          onConfirm={submit}
          confirmDisabled={submitting}
        >
          These items will be added to the table and
          visible to staff. You will still be able to
          add more items later.
        </Modal>
      )}
    </div>
  )
}
