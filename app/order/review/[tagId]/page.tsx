"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AllergenList } from "@/components/menu/AllergenList"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { Toast } from "@/components/ui/Toast"
import { toCustomerErrorMessage } from "@/lib/customerCopy"
import { fetchJson } from "@/lib/fetchJson"
import { calculateCartTotals } from "@/lib/pricing"
import { OrderSubmissionItemDTO } from "@/lib/types"
import { useCartStore } from "@/store/useCartStore"
import { useSessionStore } from "@/store/useSessionStore"

function isTakeaway(tagId: string) {
  return tagId.trim().toLowerCase() === "takeaway"
}

function customerContextLabel(takeaway: boolean) {
  return takeaway ? "Takeaway" : "Table menu"
}

export default function PerUserReviewPage({
  params,
}: {
  params: { tagId: string }
}) {
  const router = useRouter()
  const tagId = params.tagId
  const takeaway = isTakeaway(tagId)

  const sessionId = useSessionStore(s => s.sessionId)
  const setScope = useCartStore(s => s.setScope)
  const items = useCartStore(s => s.items)
  const clearSubmittedItems = useCartStore(
    s => s.clearSubmittedItems
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!sessionId) return
    setScope(`customer:${tagId}:${sessionId}`)
  }, [sessionId, tagId, setScope])

  const totals = useMemo(() => {
    return calculateCartTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      }))
    )
  }, [items])

  async function submit() {
    if (!sessionId || items.length === 0) return

    const requestKey =
      idempotencyKey ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

    if (!idempotencyKey) {
      setIdempotencyKey(requestKey)
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: OrderSubmissionItemDTO[] = items.map(i => ({
        itemId: i.id,
        name: i.name,
        quantity: i.quantity,
        edits: i.edits,
        allergens: i.allergens,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        station: i.station,
      }))

      await fetchJson("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          tagId,
          items: payload,
          idempotencyKey: requestKey,
        }),
      })

      clearSubmittedItems()
      setIdempotencyKey(null)
      router.push(`/order/${tagId}`)
    } catch (e) {
      setError(toCustomerErrorMessage(e))
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-secondary">
        No items to review.
      </div>
    )
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-[920px] space-y-4">
        {error && <Toast>{error}</Toast>}

        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="display-font text-4xl tracking-tight">
              Review Order
            </h1>
            <p className="text-sm text-secondary">
              {takeaway
                ? "This order will be sent as takeaway."
                : "Only your items will be added to the table. You can add more items later."}
            </p>
            <div className="status-chip status-chip-neutral inline-flex">
              {customerContextLabel(takeaway)}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {item.quantity} x {item.name}
                  </div>
                  {item.edits && (
                    <div className="text-xs text-muted">Modified</div>
                  )}
                  <AllergenList
                    allergens={item.allergens}
                    collapsible
                  />
                </div>

                <div className="text-sm font-semibold">
                  £{(item.unitPrice * item.quantity).toFixed(2)}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card variant="accent">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>£{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="quiet"
            onClick={() => router.push(`/order/${tagId}`)}
            disabled={submitting}
          >
            Back
          </Button>

          <Button
            onClick={() => setShowConfirm(true)}
            disabled={submitting || !sessionId}
          >
            Place order
          </Button>
        </div>
      </div>

      {showConfirm && (
        <Modal
          title="Place order"
          onCancel={() => setShowConfirm(false)}
          onConfirm={submit}
          confirmDisabled={submitting}
          confirmLabel={submitting ? "Placing..." : "Place order"}
        >
          {takeaway
            ? "Place this takeaway order now."
            : "Place these items to the table now."}
        </Modal>
      )}
    </div>
  )
}
