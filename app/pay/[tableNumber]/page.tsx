"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { CustomerCheckoutQuoteDTO, PromoCodeDTO } from "@/lib/types"

type CheckoutResponse = {
  quote: CustomerCheckoutQuoteDTO
  bill: {
    dueTotal: number
    paidTotal: number
    total: number
  }
  receipt: {
    receiptId: string
    totalCharged: number
    tipAmount: number
    method: "APPLE_PAY" | "GOOGLE_PAY" | "CARD"
    email: string | null
  }
  promoDiscount: number
}

function money(value: number) {
  return `£${value.toFixed(2)}`
}

export default function CustomerCheckoutPage({
  params,
}: {
  params: { tableNumber: string }
}) {
  const router = useRouter()
  const tableNumber = Number(params.tableNumber)

  const [quote, setQuote] = useState<CustomerCheckoutQuoteDTO | null>(null)
  const [promos, setPromos] = useState<PromoCodeDTO[]>([])
  const [shareCount, setShareCount] = useState("1")
  const [amount, setAmount] = useState("")
  const [tipPercent, setTipPercent] = useState("10")
  const [method, setMethod] = useState<"APPLE_PAY" | "GOOGLE_PAY" | "CARD">("APPLE_PAY")
  const [email, setEmail] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [redeemPoints, setRedeemPoints] = useState("0")
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResponse | null>(null)

  useEffect(() => {
    if (!Number.isFinite(tableNumber)) {
      setError("Invalid table number")
      return
    }

    Promise.allSettled([
      fetchJson<CustomerCheckoutQuoteDTO>(`/api/customer/checkout?tableNumber=${tableNumber}`, {
        cache: "no-store",
      }),
      fetchJson<PromoCodeDTO[]>("/api/customer/engagement?view=promos", {
        cache: "no-store",
      }),
    ])
      .then(([quoteResult, promoResult]) => {
        if (quoteResult.status === "fulfilled") {
          setQuote(quoteResult.value)
          setAmount(quoteResult.value.suggestedShareAmount.toFixed(2))
        } else {
          throw quoteResult.reason
        }
        if (promoResult.status === "fulfilled") {
          setPromos(promoResult.value.filter(item => item.active))
        }
      })
      .catch(err => setError((err as Error).message))
  }, [tableNumber])

  const estimatedTotal = useMemo(() => {
    const base = Number(amount || "0")
    const tip = Number(tipPercent || "0")
    const tipAmount = Number.isFinite(base) && Number.isFinite(tip)
      ? base * (tip / 100)
      : 0
    return base + tipAmount
  }, [amount, tipPercent])

  async function submitCheckout() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = await fetchJson<CheckoutResponse>("/api/customer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber,
          shareCount: Number(shareCount || "1"),
          amount: Number(amount || "0"),
          tipPercent: Number(tipPercent || "0"),
          method,
          email: email || null,
          promoCode: promoCode || null,
          customerId: customerId || null,
          customerName: customerName || null,
          phone: phone || null,
          marketingOptIn,
          redeemPoints: Number(redeemPoints || "0"),
        }),
      })
      setResult(payload)
      setQuote(payload.quote)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[820px] space-y-4">
        <Card variant="elevated">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Pay Table {Number.isFinite(tableNumber) ? tableNumber : "?"}
            </h1>
            <p className="text-sm text-secondary">
              Pay your share, add tip, apply promo, and get an email receipt.
            </p>
            {quote && (
              <div className="status-chip status-chip-neutral inline-flex">
                Due now: {money(quote.dueTotal)}
              </div>
            )}
          </div>
        </Card>

        {error && <div className="status-chip status-chip-danger inline-flex">{error}</div>}

        <Card className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs text-muted">
              Split count
              <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={shareCount} onChange={e => setShareCount(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Amount
              <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Tip %
              <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={tipPercent} onChange={e => setTipPercent(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Payment method
              <select className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={method} onChange={e => setMethod(e.target.value as "APPLE_PAY" | "GOOGLE_PAY" | "CARD")}>
                <option value="APPLE_PAY">Apple Pay</option>
                <option value="GOOGLE_PAY">Google Pay</option>
                <option value="CARD">Card</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              Email receipt
              <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Promo code
              <input list="promo-codes" className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
              <datalist id="promo-codes">
                {promos.map(promo => <option key={promo.code} value={promo.code} />)}
              </datalist>
            </label>
            <label className="space-y-1 text-xs text-muted">
              Customer ID (optional)
              <input className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]" value={customerId} onChange={e => setCustomerId(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Name / Phone / Redeem points
              <div className="grid grid-cols-3 gap-2">
                <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]" placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                <input className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]" placeholder="Points" value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} />
              </div>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} />
            Accept marketing updates
          </label>

          <div className="rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 text-sm">
            Estimated charge: <span className="font-semibold">{money(estimatedTotal)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={submitting || !quote} onClick={submitCheckout}>
              {submitting ? "Processing..." : "Pay now"}
            </Button>
            <Button variant="quiet" disabled={submitting} onClick={() => router.push("/menu")}>
              Back to menu
            </Button>
          </div>
        </Card>

        {result && (
          <Card variant="accent" className="space-y-1">
            <div className="text-base font-semibold">Payment complete</div>
            <div className="text-sm text-secondary">Receipt {result.receipt.receiptId.slice(0, 8)}</div>
            <div className="text-sm">Charged: {money(result.receipt.totalCharged)} ({result.receipt.method})</div>
            <div className="text-sm">Tip: {money(result.receipt.tipAmount)}</div>
            <div className="text-sm">Remaining due: {money(result.bill.dueTotal)}</div>
          </Card>
        )}
      </div>
    </div>
  )
}
