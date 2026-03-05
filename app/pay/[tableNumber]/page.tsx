"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  useRouter,
  useSearchParams,
} from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { tipPresetsForStrategy } from "@/lib/customerExperience"
import { fetchJson } from "@/lib/fetchJson"
import { trackUxFunnelEventClient } from "@/lib/uxClient"
import {
  CustomerCheckoutQuoteDTO,
  PromoCodeDTO,
} from "@/lib/types"
import { useUxFunnelTracking } from "@/lib/useUxFunnelTracking"
import { useRestaurantStore } from "@/store/useRestaurantStore"

declare global {
  interface Window {
    Stripe?: (
      publishableKey: string,
      options?: {
        stripeAccount?: string
      }
    ) => any
  }
}

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
  idempotencyReplay?: boolean
}

type ExternalIntentResponse = {
  checkout: {
    tableNumber: number
    amount: number
    tipAmount: number
    totalCharged: number
  }
  paymentIntent: {
    provider: string
    mode: "EXTERNAL"
    paymentIntentId: string
    clientSecret: string
    status: string
    amount: number
    currency: string
    stripeAccountId: string
    publishableKey: string
    applicationFeeAmount: number
  }
}

type CheckoutRequestBody = {
  tableNumber: number
  shareCount: number
  amount: number
  tipPercent: number
  method: "APPLE_PAY" | "GOOGLE_PAY" | "CARD"
  email: string | null
  promoCode: string | null
  customerId: string | null
  customerName: string | null
  phone: string | null
  marketingOptIn: boolean
  redeemPoints: number
  idempotencyKey: string
}

let stripeLoader: Promise<NonNullable<Window["Stripe"]>> | null = null

function money(value: number) {
  return `GBP ${value.toFixed(2)}`
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `checkout-${crypto.randomUUID()}`
  }
  return `checkout-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function loadStripeJs() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Stripe.js is only available in the browser"))
  }

  if (window.Stripe) {
    return Promise.resolve(window.Stripe)
  }

  if (!stripeLoader) {
    stripeLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://js.stripe.com/v3/"]'
      )
      if (existing) {
        existing.addEventListener("load", () => {
          if (window.Stripe) {
            resolve(window.Stripe)
          } else {
            reject(new Error("Stripe.js did not initialize"))
          }
        })
        existing.addEventListener("error", () => {
          reject(new Error("Failed to load Stripe.js"))
        })
        return
      }

      const script = document.createElement("script")
      script.src = "https://js.stripe.com/v3/"
      script.async = true
      script.onload = () => {
        if (window.Stripe) {
          resolve(window.Stripe)
          return
        }
        reject(new Error("Stripe.js did not initialize"))
      }
      script.onerror = () => {
        reject(new Error("Failed to load Stripe.js"))
      }
      document.head.appendChild(script)
    })
  }

  return stripeLoader
}

export default function CustomerCheckoutPage({
  params,
}: {
  params: { tableNumber: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tableNumber = Number(params.tableNumber)
  const uxConfig = useRestaurantStore(s => s.experienceConfig.ux)
  const uxTracking = useUxFunnelTracking({
    page: "checkout",
    step: "pay",
  })

  const [quote, setQuote] = useState<CustomerCheckoutQuoteDTO | null>(null)
  const [promos, setPromos] = useState<PromoCodeDTO[]>([])
  const [shareCount, setShareCount] = useState("1")
  const [amount, setAmount] = useState("")
  const [tipPercent, setTipPercent] = useState(
    String(uxConfig.defaultTipPercent)
  )
  const [method, setMethod] = useState<"APPLE_PAY" | "GOOGLE_PAY" | "CARD">("CARD")
  const [email, setEmail] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [redeemPoints, setRedeemPoints] = useState("0")
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    createIdempotencyKey()
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResponse | null>(null)
  const [externalIntent, setExternalIntent] = useState<
    ExternalIntentResponse["paymentIntent"] | null
  >(null)
  const [guidedStep, setGuidedStep] = useState(1)
  const strictCheckoutSafety = uxConfig.checkoutSafetyMode === "STRICT"
  const [strictAmountConfirmed, setStrictAmountConfirmed] = useState(false)
  const [strictMethodConfirmed, setStrictMethodConfirmed] = useState(false)

  const stripeRef = useRef<any>(null)
  const elementsRef = useRef<any>(null)
  const paymentElementRef = useRef<any>(null)
  const paymentMountRef = useRef<HTMLDivElement | null>(null)
  const lastCompletedIntentRef = useRef<string | null>(null)

  useEffect(() => {
    setTipPercent(prev =>
      prev === "" || prev === "10"
        ? String(uxConfig.defaultTipPercent)
        : prev
    )
  }, [uxConfig.defaultTipPercent])

  useEffect(() => {
    if (!Number.isFinite(tableNumber)) {
      setError("Invalid table number")
      return
    }

    Promise.allSettled([
      fetchJson<CustomerCheckoutQuoteDTO>(
        `/api/customer/checkout?tableNumber=${tableNumber}`,
        {
          cache: "no-store",
        }
      ),
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

  useEffect(() => {
    if (!externalIntent || !paymentMountRef.current) {
      return
    }

    let cancelled = false

    if (paymentMountRef.current) {
      paymentMountRef.current.innerHTML = ""
    }
    setStatusMessage("Loading secure payment form...")

    loadStripeJs()
      .then(factory => {
        if (cancelled) return
        // Destination charges are confirmed on the platform account.
        const stripe = factory(externalIntent.publishableKey)
        if (!stripe) {
          throw new Error("Stripe could not be initialized")
        }
        const elements = stripe.elements({
          clientSecret: externalIntent.clientSecret,
        })
        const paymentElement = elements.create("payment")
        paymentElement.mount(paymentMountRef.current)
        stripeRef.current = stripe
        elementsRef.current = elements
        paymentElementRef.current = paymentElement
        setStatusMessage("Secure payment form ready. Enter card details.")
      })
      .catch(err => {
        if (!cancelled) {
          setError((err as Error).message)
          setStatusMessage(null)
        }
      })

    return () => {
      cancelled = true
      try {
        paymentElementRef.current?.unmount()
      } catch {
        // Best effort cleanup only.
      }
      paymentElementRef.current = null
      elementsRef.current = null
      stripeRef.current = null
    }
  }, [externalIntent])

  const estimatedTotal = useMemo(() => {
    const base = Number(amount || "0")
    const tip = Number(tipPercent || "0")
    const tipAmount =
      Number.isFinite(base) && Number.isFinite(tip)
        ? base * (tip / 100)
        : 0
    return base + tipAmount
  }, [amount, tipPercent])

  function checkoutBody(
    overrides?: Partial<CheckoutRequestBody>
  ): CheckoutRequestBody {
    return {
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
      idempotencyKey,
      ...overrides,
    }
  }

  const resetExternalIntent = useCallback(() => {
    setExternalIntent(null)
    setStatusMessage(null)
    try {
      paymentElementRef.current?.unmount()
    } catch {
      // Best effort cleanup only.
    }
    paymentElementRef.current = null
    elementsRef.current = null
    stripeRef.current = null
  }, [])

  async function submitDirectCheckout(
    bodyOverrides?: Partial<CheckoutRequestBody>
  ) {
    setSubmitting(true)
    setError(null)
    setStatusMessage(null)
    try {
      const payload = await fetchJson<CheckoutResponse>(
        "/api/customer/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(checkoutBody(bodyOverrides)),
        }
      )
      setResult(payload)
      setQuote(payload.quote)
      resetExternalIntent()
      if (!payload.idempotencyReplay) {
        setIdempotencyKey(createIdempotencyKey())
      }
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
        eventName: "checkout_success",
        page: "checkout",
        step: "pay",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
        value: payload.receipt.totalCharged,
      })
    } catch (err) {
      setError((err as Error).message)
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
        eventName: "checkout_error",
        page: "checkout",
        step: "pay",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
        metadata: {
          mode: "direct",
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function initializeExternalCheckout(
    bodyOverrides?: Partial<CheckoutRequestBody>
  ) {
    setSubmitting(true)
    setError(null)
    setStatusMessage(null)
    try {
      const payload = await fetchJson<ExternalIntentResponse>(
        "/api/customer/checkout/intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(checkoutBody(bodyOverrides)),
        }
      )
      setExternalIntent(payload.paymentIntent)
      setResult(null)
      setStatusMessage("Secure payment form ready. Enter card details.")
    } finally {
      setSubmitting(false)
    }
  }

  const completeExternalCheckout = useCallback(
    async (paymentIntentId: string) => {
      setSubmitting(true)
      setError(null)
      setStatusMessage("Finalizing your receipt...")
      try {
        const payload = await fetchJson<CheckoutResponse>(
          "/api/customer/checkout/complete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentIntentId,
            }),
          }
        )
        setResult(payload)
        setQuote(payload.quote)
        resetExternalIntent()
        setStatusMessage("Payment complete.")
        if (!payload.idempotencyReplay) {
          setIdempotencyKey(createIdempotencyKey())
        }
        void trackUxFunnelEventClient({
          sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
          eventName: "checkout_success",
          page: "checkout",
          step: "confirm",
          experimentKey: uxTracking.experimentKey ?? undefined,
          variantKey: uxTracking.variantKey ?? undefined,
          value: payload.receipt.totalCharged,
        })
      } catch (err) {
        setError((err as Error).message)
        setStatusMessage(null)
        void trackUxFunnelEventClient({
          sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
          eventName: "checkout_error",
          page: "checkout",
          step: "confirm",
          experimentKey: uxTracking.experimentKey ?? undefined,
          variantKey: uxTracking.variantKey ?? undefined,
          metadata: {
            mode: "external",
          },
        })
      } finally {
        setSubmitting(false)
      }
    },
    [resetExternalIntent, tableNumber, uxTracking.experimentKey, uxTracking.sessionId, uxTracking.variantKey]
  )

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent")?.trim() ?? ""
    if (!paymentIntentId) return
    if (lastCompletedIntentRef.current === paymentIntentId) return
    lastCompletedIntentRef.current = paymentIntentId
    void completeExternalCheckout(paymentIntentId)
  }, [completeExternalCheckout, searchParams])

  async function confirmExternalCheckout() {
    if (!stripeRef.current || !elementsRef.current || !externalIntent) {
      setError("Secure payment form is still loading")
      return
    }

    setSubmitting(true)
    setError(null)
    setStatusMessage("Confirming payment with Stripe...")

    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: window.location.href.split("?")[0],
        },
        redirect: "if_required",
      })

      if (result.error) {
        throw new Error(result.error.message || "Stripe payment failed")
      }

      const paymentIntentId =
        result.paymentIntent?.id || externalIntent.paymentIntentId
      const status = result.paymentIntent?.status || externalIntent.status

      if (status === "succeeded" && paymentIntentId) {
        await completeExternalCheckout(paymentIntentId)
        return
      }

      if (status === "processing") {
        setStatusMessage(
          "Stripe is processing the payment. Your receipt will finalize shortly."
        )
        setSubmitting(false)
        return
      }

      if (status === "requires_action") {
        setStatusMessage(
          "Additional authentication is required. Continue in the Stripe flow."
        )
        setSubmitting(false)
        return
      }

      if (paymentIntentId) {
        await completeExternalCheckout(paymentIntentId)
        return
      }

      throw new Error("Stripe did not return a payment result")
    } catch (err) {
      setError((err as Error).message)
      setStatusMessage(null)
      setSubmitting(false)
    }
  }

  async function handlePrimaryAction(
    bodyOverrides?: Partial<CheckoutRequestBody>
  ) {
    if (externalIntent) {
      await confirmExternalCheckout()
      return
    }

    try {
      await initializeExternalCheckout(bodyOverrides)
    } catch (err) {
      const message = (err as Error).message
      if (
        message ===
        "External checkout intents are only available for production tenants"
      ) {
        await submitDirectCheckout(bodyOverrides)
        return
      }
      setError(message)
    }
  }

  async function runExpressCheckout() {
    if (!quote) return
    const expressAmount = Number(quote.suggestedShareAmount.toFixed(2))
    const expressTip = uxConfig.defaultTipPercent

    setShareCount("1")
    setAmount(expressAmount.toFixed(2))
    setTipPercent(String(expressTip))
    void trackUxFunnelEventClient({
      sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
      eventName: "checkout_express_attempt",
      page: "checkout",
      step: "pay",
      experimentKey: uxTracking.experimentKey ?? undefined,
      variantKey: uxTracking.variantKey ?? undefined,
      value: expressAmount,
    })

    await handlePrimaryAction({
      shareCount: 1,
      amount: expressAmount,
      tipPercent: expressTip,
    })
  }

  const guidedSplit = uxConfig.checkout === "GUIDED_SPLIT"
  const expressFirst = uxConfig.checkout === "EXPRESS_FIRST"
  const checkoutFlowLabel =
    uxConfig.checkout === "GUIDED_SPLIT"
      ? "Guided split flow"
      : uxConfig.checkout === "EXPRESS_FIRST"
        ? "Express-first flow"
        : "One-page flow"
  const trustMessage =
    uxConfig.trustMicrocopy === "HIGH_ASSURANCE"
      ? "Bank-grade checkout handoff with Stripe and duplicate-charge protection."
      : uxConfig.trustMicrocopy === "MINIMAL"
        ? "Quick payment flow."
        : "Secure payment with receipt confirmation."
  const tipPresets = tipPresetsForStrategy({
    strategy: uxConfig.tipPresetStrategy,
    defaultTipPercent: uxConfig.defaultTipPercent,
  }).map(value => String(value))

  function validateCheckoutInput() {
    const parsedShareCount = Number(shareCount || "0")
    const parsedAmount = Number(amount || "0")
    const parsedTip = Number(tipPercent || "0")

    if (!Number.isFinite(parsedShareCount) || parsedShareCount <= 0) {
      return "Split count must be at least 1."
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return "Amount must be greater than 0."
    }

    if (quote && parsedAmount > quote.dueTotal) {
      return "Amount cannot exceed the current due total."
    }

    if (!Number.isFinite(parsedTip) || parsedTip < 0 || parsedTip > 30) {
      return "Tip must be between 0 and 30."
    }

    if (
      email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return "Enter a valid email or leave it blank."
    }

    if (
      strictCheckoutSafety &&
      (!strictAmountConfirmed || !strictMethodConfirmed)
    ) {
      return "Confirm the strict checkout checklist before paying."
    }

    return null
  }

  async function handlePrimaryButtonClick() {
    if (guidedSplit && guidedStep < 3) {
      setGuidedStep(prev => Math.min(3, prev + 1))
      return
    }
    const validationError = validateCheckoutInput()
    if (validationError) {
      setError(validationError)
      void trackUxFunnelEventClient({
        sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
        eventName: "checkout_validation_error",
        page: "checkout",
        step: "validate",
        experimentKey: uxTracking.experimentKey ?? undefined,
        variantKey: uxTracking.variantKey ?? undefined,
      })
      return
    }
    void trackUxFunnelEventClient({
      sessionId: uxTracking.sessionId || `checkout-${tableNumber}`,
      eventName: "checkout_pay_attempt",
      page: "checkout",
      step: "pay",
      experimentKey: uxTracking.experimentKey ?? undefined,
      variantKey: uxTracking.variantKey ?? undefined,
      value: Number(amount || "0"),
    })
    await handlePrimaryAction()
  }

  return (
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -left-16 top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.22),rgba(201,169,110,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="menu-orbit pointer-events-none absolute -right-10 top-44 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(98,145,215,0.22),rgba(98,145,215,0))] blur-3xl [animation-delay:240ms]"
      />

      <div className="mx-auto max-w-[920px] space-y-4">
        <Card
          variant="elevated"
          className="menu-reveal border-[rgba(201,169,110,0.36)] bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(245,232,206,0.9))]"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Guest Checkout
              </div>
              <h1 className="display-font text-4xl leading-tight tracking-tight">
                Pay table {Number.isFinite(tableNumber) ? tableNumber : "?"}
              </h1>
              <p className="text-sm leading-6 text-secondary">
                Split the bill, add tip, and complete secure payment with
                receipt delivery.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.64)] px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Due now
              </div>
              <div className="display-font mt-1 text-3xl leading-none">
                {quote ? money(quote.dueTotal) : "GBP 0.00"}
              </div>
              <div className="mt-1 text-xs text-secondary">
                Estimated charge: {money(estimatedTotal)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="status-chip status-chip-neutral">
              Share flow enabled
            </span>
            <span className="status-chip status-chip-neutral">
              Promo and loyalty support
            </span>
            <span className="status-chip status-chip-neutral">
              Stripe secure capture
            </span>
            <span className="status-chip status-chip-neutral">
              {checkoutFlowLabel}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.58)] px-3 py-2 text-xs text-secondary">
            {trustMessage}
          </div>
        </Card>

        {error && (
          <div className="status-chip status-chip-danger inline-flex">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="status-chip status-chip-neutral inline-flex">
            {statusMessage}
          </div>
        )}

        <Card className="menu-reveal menu-delay-1 space-y-3 border-[rgba(201,169,110,0.36)] bg-[linear-gradient(160deg,rgba(255,251,242,0.97),rgba(246,234,211,0.92))]">
          {guidedSplit && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`status-chip ${
                  guidedStep >= 1
                    ? "status-chip-success"
                    : "status-chip-neutral"
                }`}
              >
                1. Payment setup
              </span>
              <span
                className={`status-chip ${
                  guidedStep >= 2
                    ? "status-chip-success"
                    : "status-chip-neutral"
                }`}
              >
                2. Customer details
              </span>
              <span
                className={`status-chip ${
                  guidedStep >= 3
                    ? "status-chip-success"
                    : "status-chip-neutral"
                }`}
              >
                3. Confirm
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(!guidedSplit || guidedStep >= 1) && (
            <section className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.62)] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Payment setup
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <label className="space-y-1 text-xs text-muted">
                  Split count
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={shareCount}
                    onChange={e => setShareCount(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted">
                  Amount
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted">
                  Tip %
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={tipPercent}
                    onChange={e => setTipPercent(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {tipPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTipPercent(preset)}
                      className={`focus-ring rounded-full border px-3 py-1 text-xs font-semibold ${
                        tipPercent === preset
                          ? "border-transparent bg-[var(--accent-action)] text-white"
                          : "border-[var(--border)] bg-[rgba(255,255,255,0.68)]"
                      }`}
                    >
                      {preset}% tip
                    </button>
                  ))}
                </div>
                <label className="space-y-1 text-xs text-muted">
                  Payment method
                  <select
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={method}
                    onChange={e =>
                      setMethod(
                        e.target.value as
                          | "APPLE_PAY"
                          | "GOOGLE_PAY"
                          | "CARD"
                      )
                    }
                  >
                    <option value="CARD">Card</option>
                    <option value="APPLE_PAY">Apple Pay</option>
                    <option value="GOOGLE_PAY">Google Pay</option>
                  </select>
                </label>
              </div>
            </section>
            )}

            {(!guidedSplit || guidedStep >= 2) && (
            <section className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.62)] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Customer details
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <label className="space-y-1 text-xs text-muted">
                  Email receipt
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted">
                  Promo code
                  <input
                    list="promo-codes"
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={promoCode}
                    onChange={e =>
                      setPromoCode(e.target.value.toUpperCase())
                    }
                  />
                  <datalist id="promo-codes">
                    {promos.map(promo => (
                      <option key={promo.code} value={promo.code} />
                    ))}
                  </datalist>
                </label>
                <label className="space-y-1 text-xs text-muted">
                  Customer ID (optional)
                  <input
                    className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted">
                  Name / Phone / Redeem points
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]"
                      placeholder="Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                    <input
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]"
                      placeholder="Phone"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                    <input
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-2 py-2 text-xs text-[var(--text-primary)]"
                      placeholder="Points"
                      value={redeemPoints}
                      onChange={e => setRedeemPoints(e.target.value)}
                    />
                  </div>
                </label>
              </div>
            </section>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={e => setMarketingOptIn(e.target.checked)}
            />
            Optional: receive marketing updates
          </label>

          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.58)] px-3 py-2 text-sm">
            Estimated charge:{" "}
            <span className="font-semibold">{money(estimatedTotal)}</span>
          </div>

          {strictCheckoutSafety && (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.58)] px-3 py-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Strict checkout checklist
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={strictAmountConfirmed}
                  onChange={event =>
                    setStrictAmountConfirmed(event.target.checked)
                  }
                />
                I confirmed the amount and split details are correct.
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={strictMethodConfirmed}
                  onChange={event =>
                    setStrictMethodConfirmed(event.target.checked)
                  }
                />
                I confirmed the payment method and receipt details.
              </label>
              <div className="text-xs text-secondary">
                Need help? Ask a staff member before final payment.
              </div>
            </div>
          )}

          {expressFirst && (
            <Button
              variant="secondary"
              disabled={
                submitting ||
                !quote ||
                (strictCheckoutSafety &&
                  (!strictAmountConfirmed || !strictMethodConfirmed))
              }
              onClick={() => runExpressCheckout().catch(() => {})}
            >
              Quick pay suggested share ({money(
                quote?.suggestedShareAmount ?? 0
              )} + {uxConfig.defaultTipPercent}% tip)
            </Button>
          )}

          {externalIntent && (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[rgba(255,255,255,0.56)] p-3">
              <div className="text-sm font-semibold">
                Secure card form
              </div>
              <div
                ref={paymentMountRef}
                className="min-h-[56px]"
              />
              <div className="text-xs text-secondary">
                Payment intent: {externalIntent.paymentIntentId}
              </div>
              <Button
                variant="quiet"
                disabled={submitting}
                onClick={resetExternalIntent}
              >
                Reset secure payment
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {guidedSplit && guidedStep > 1 && !externalIntent && (
              <Button
                variant="quiet"
                disabled={submitting}
                onClick={() =>
                  setGuidedStep(prev => Math.max(1, prev - 1))
                }
              >
                Back step
              </Button>
            )}
            <Button
              disabled={
                submitting ||
                !quote ||
                (strictCheckoutSafety &&
                  (!strictAmountConfirmed || !strictMethodConfirmed))
              }
              onClick={() => handlePrimaryButtonClick().catch(() => {})}
            >
              {submitting
                ? "Processing..."
                : externalIntent
                  ? "Confirm payment"
                  : guidedSplit && guidedStep < 3
                    ? "Continue"
                  : "Pay now"}
            </Button>
            <Button
              variant="quiet"
              disabled={submitting}
              onClick={() => router.push("/menu")}
            >
              Back to menu
            </Button>
          </div>
        </Card>

        {result && (
          <Card
            variant="accent"
            className="menu-reveal menu-delay-1 space-y-1 border-[rgba(201,169,110,0.34)] bg-[linear-gradient(162deg,rgba(231,246,236,0.95),rgba(216,238,225,0.92))]"
          >
            <div className="text-base font-semibold">Payment complete</div>
            <div className="text-sm text-secondary">
              Receipt {result.receipt.receiptId.slice(0, 8)}
            </div>
            <div className="text-sm">
              Charged: {money(result.receipt.totalCharged)} (
              {result.receipt.method})
            </div>
            <div className="text-sm">
              Tip: {money(result.receipt.tipAmount)}
            </div>
            <div className="text-sm">
              Remaining due: {money(result.bill.dueTotal)}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
