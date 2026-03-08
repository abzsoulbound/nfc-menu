"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AllergenList } from "@/components/menu/AllergenList"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { Toast } from "@/components/ui/Toast"
import { getMenuItemIdFromCartLineId } from "@/lib/cartLine"
import { toCustomerErrorMessage } from "@/lib/customerCopy"
import { fetchJson } from "@/lib/fetchJson"
import { calculateCartTotals } from "@/lib/pricing"
import { trackUxFunnelEventClient } from "@/lib/uxClient"
import { OrderSubmissionItemDTO } from "@/lib/types"
import { useUxFunnelTracking } from "@/lib/useUxFunnelTracking"
import { useCartStore } from "@/store/useCartStore"
import { useRestaurantStore } from "@/store/useRestaurantStore"
import { useSessionStore } from "@/store/useSessionStore"
import { haptic } from "@/lib/haptics"

function isTakeaway(tagId: string) {
  return tagId.trim().toLowerCase() === "takeaway"
}

function customerContextLabel(takeaway: boolean) {
  return takeaway ? "Takeaway" : "Table menu"
}

function formatCurrency(value: number) {
  return `£${value.toFixed(2)}`
}

function describeEdits(edits: {
  removals?: string[]
  swaps?: Array<{ from: string; to: string }>
  addOns?: Array<{ name: string; priceDelta: number }>
} | null | undefined) {
  if (!edits) return []

  const lines: string[] = []
  for (const removal of edits.removals ?? []) {
    lines.push(`No ${removal}`)
  }
  for (const swap of edits.swaps ?? []) {
    lines.push(`${swap.from} -> ${swap.to}`)
  }
  for (const addOn of edits.addOns ?? []) {
    lines.push(`+ ${addOn.name} (${formatCurrency(addOn.priceDelta)})`)
  }
  return lines
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
  const reviewConfig = useRestaurantStore(
    s => s.experienceConfig.review
  )
  const uxConfig = useRestaurantStore(s => s.experienceConfig.ux)
  const uxTracking = useUxFunnelTracking({
    page: "order_review",
    step: "review",
  })
  const strictOrderSafety = uxConfig.orderSafetyMode === "STRICT"

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState<
    string | null
  >(null)
  const [checkItemsConfirmed, setCheckItemsConfirmed] = useState(false)
  const [editsConfirmed, setEditsConfirmed] = useState(false)

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
  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  async function submit() {
    if (!sessionId || items.length === 0) return
    if (strictOrderSafety && (!checkItemsConfirmed || !editsConfirmed)) {
      setError("Please confirm the review checklist before placing the order.")
      return
    }

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
        itemId: getMenuItemIdFromCartLineId(i.id),
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
      haptic("submit")
      void trackUxFunnelEventClient({
        sessionId: sessionId ?? `review-${tagId}`,
        eventName: "review_submit_success",
        page: "order_review",
        step: "submit",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
        metadata: {
          takeaway,
          totalQuantity,
          totalValue: totals.total,
        },
      })
      router.push(`/order/${tagId}`)
    } catch (e) {
      setError(toCustomerErrorMessage(e))
      void trackUxFunnelEventClient({
        sessionId: sessionId ?? `review-${tagId}`,
        eventName: "review_submit_error",
        page: "order_review",
        step: "submit",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
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
    <div className="page-container overflow-hidden">
      <div
        aria-hidden="true"
        className="menu-orbit decor-orb -left-14 top-14 h-40 w-40 decor-orb-gold"
      />
      <div
        aria-hidden="true"
        className="menu-orbit decor-orb -right-10 top-44 h-44 w-44 decor-orb-navy [animation-delay:220ms]"
      />

      <div className="page-container-inner space-y-8 pb-24">
        {error && <Toast>{error}</Toast>}

        <Card
          variant="elevated"
          className="menu-reveal section-hero"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                {customerContextLabel(takeaway)}
              </div>
              <h1 className="display-font text-4xl tracking-tight">
                {reviewConfig.title}
              </h1>
              <p className="text-base leading-relaxed text-secondary">
                {takeaway
                  ? reviewConfig.subtitleTakeaway
                  : reviewConfig.subtitleDineIn}
              </p>
            </div>

            <div className="rounded-xl surface-glass-light px-5 py-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                Order total
              </div>
              <div className="display-font mt-1 text-3xl leading-none">
                {formatCurrency(totals.total)}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {totalQuantity} item{totalQuantity === 1 ? "" : "s"} ready
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="status-chip status-chip-neutral">
              Review before send
            </span>
            <span className="status-chip status-chip-neutral">
              Idempotent submit protected
            </span>
            {uxConfig.review === "PAGE_REVIEW" && (
              <span className="status-chip status-chip-neutral">
                Full-page review flow
              </span>
            )}
          </div>

          {uxConfig.showProgressAnchors && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="status-chip status-chip-neutral inline-flex">
                1. Check items
              </span>
              <span className="status-chip status-chip-neutral inline-flex">
                2. Confirm edits
              </span>
              <span className="status-chip status-chip-neutral inline-flex">
                3. Place order
              </span>
            </div>
          )}

          {uxConfig.trustMicrocopy === "HIGH_ASSURANCE" && (
            <div className="mt-3 rounded-xl surface-glass-light px-3 py-2 text-xs text-secondary">
              Your order is sent once and protected against duplicate submits.
            </div>
          )}

          {uxConfig.socialProofMode !== "OFF" && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="status-chip status-chip-success">
                {uxConfig.socialProofMode === "VERIFIED_REVIEWS"
                  ? "Verified guest reviews"
                  : "Verified guest usage"}
              </span>
              <span className="status-chip status-chip-success">
                Evidence-based trust cues
              </span>
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="status-chip status-chip-neutral">
              Experience: {uxConfig.ordering.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>

          {strictOrderSafety && (
            <div className="mt-3 space-y-2 rounded-xl surface-glass-light px-3 py-3 text-xs text-secondary">
              <div className="font-semibold text-[var(--text-primary)]">
                Strict review checklist
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checkItemsConfirmed}
                  onChange={event =>
                    setCheckItemsConfirmed(event.target.checked)
                  }
                />
                I checked item quantities and names.
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={editsConfirmed}
                  onChange={event =>
                    setEditsConfirmed(event.target.checked)
                  }
                />
                I reviewed edits/allergens and want to submit now.
              </label>
            </div>
          )}
        </Card>

        <div className="menu-reveal menu-delay-1 space-y-3">
          {items.map(item => (
            <Card
              key={item.id}
              className="surface-glass-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold tracking-tight">
                    {item.quantity} x {item.name}
                  </div>
                  {describeEdits(item.edits).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {describeEdits(item.edits).map(line => (
                        <span
                          key={`${item.id}-${line}`}
                          className="status-chip status-chip-neutral inline-flex"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  {reviewConfig.showAllergens && (
                    <div className="mt-2">
                      <AllergenList
                        allergens={item.allergens}
                        collapsible
                      />
                    </div>
                  )}
                </div>

                <div className="text-sm font-semibold">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card
          variant="accent"
          className="menu-reveal menu-delay-1 border-[rgba(217,174,63,0.34)] bg-[linear-gradient(162deg,rgba(250,246,239,0.95),rgba(217,174,63,0.08))]"
        >
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">VAT</span>
              <span>{formatCurrency(totals.vat)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-4 z-30 px-4 md:px-6">
        <div className="mx-auto max-w-[920px]">
          <div className="rounded-2xl border border-[rgba(217,174,63,0.45)] bg-[rgba(0,18,88,0.92)] px-3 py-3 shadow-[var(--shadow-hard)] backdrop-blur">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="text-[13px] text-[rgba(255,255,255,0.92)]">
                {totalQuantity} item{totalQuantity === 1 ? "" : "s"} |{" "}
                <span className="font-semibold">
                  {formatCurrency(totals.total)}
                </span>
              </div>
              <Button
                variant="quiet"
                onClick={() => router.push(`/order/${tagId}`)}
                disabled={submitting}
              >
                {reviewConfig.backLabel}
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={
                  submitting ||
                  !sessionId ||
                  (strictOrderSafety &&
                    (!checkItemsConfirmed || !editsConfirmed))
                }
              >
                {reviewConfig.placeOrderLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <Modal
          title="Place order"
          onCancel={() => setShowConfirm(false)}
          onConfirm={submit}
          confirmDisabled={submitting}
          confirmLabel={
            submitting ? "Placing..." : reviewConfig.placeOrderLabel
          }
        >
          {takeaway
            ? reviewConfig.confirmTakeaway
            : reviewConfig.confirmDineIn}
        </Modal>
      )}
    </div>
  )
}
