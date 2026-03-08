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
import {
  FormCheckbox,
  FormInput,
  FormSelect,
} from "@/components/ui/FormField"
import { ProgressStepper } from "@/components/ui/ProgressStepper"
import { PaymentCelebration } from "@/components/order/PaymentCelebration"
import { tipPresetsForStrategy } from "@/lib/customerExperience"
import { fetchJson } from "@/lib/fetchJson"
import { haptic } from "@/lib/haptics"
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

type CheckoutFieldErrors = Partial<{
  shareCount: string
  amount: string
  tipPercent: string
  email: string
  strictAmountConfirmed: string
  strictMethodConfirmed: string
}>

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
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
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
      haptic("success")
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
      haptic("error")
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
  const parsedAmountForTipLabels = Number(amount || "0")

  function tipPresetLabel(preset: string) {
    const numericPreset = Number(preset)
    const tipAmount =
      Number.isFinite(parsedAmountForTipLabels) &&
      parsedAmountForTipLabels > 0 &&
      Number.isFinite(numericPreset)
        ? parsedAmountForTipLabels * (numericPreset / 100)
        : 0
    return `${preset}% (£${tipAmount.toFixed(2)}) tip`
  }

  function validateCheckoutInput(): {
    formError: string | null
    fields: CheckoutFieldErrors
  } {
    const parsedShareCount = Number(shareCount || "0")
    const parsedAmount = Number(amount || "0")
    const parsedTip = Number(tipPercent || "0")
    const fields: CheckoutFieldErrors = {}

    if (!Number.isFinite(parsedShareCount) || parsedShareCount <= 0) {
      fields.shareCount = "Split count must be at least 1."
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      fields.amount = "Amount must be greater than 0."
    }

    if (quote && parsedAmount > quote.dueTotal) {
      fields.amount = "Amount cannot exceed the current due total."
    }

    if (!Number.isFinite(parsedTip) || parsedTip < 0 || parsedTip > 30) {
      fields.tipPercent = "Tip must be between 0 and 30."
    }

    if (
      email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      fields.email = "Enter a valid email or leave it blank."
    }

    if (
      strictCheckoutSafety &&
      (!strictAmountConfirmed || !strictMethodConfirmed)
    ) {
      if (!strictAmountConfirmed) {
        fields.strictAmountConfirmed =
          "Confirm the amount and split details."
      }
      if (!strictMethodConfirmed) {
        fields.strictMethodConfirmed =
          "Confirm the payment method and receipt details."
      }
    }

    if (Object.keys(fields).length > 0) {
      return {
        formError:
          "Please fix the highlighted fields before continuing.",
        fields,
      }
    }

    return {
      formError: null,
      fields: {},
    }
  }

  async function handlePrimaryButtonClick() {
    if (guidedSplit && guidedStep < 3) {
      setGuidedStep(prev => Math.min(3, prev + 1))
      return
    }
    const validation = validateCheckoutInput()
    if (validation.formError) {
      setFieldErrors(validation.fields)
      setError(validation.formError)
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
    setFieldErrors({})
    setError(null)
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
    <div className="page-container overflow-hidden">
      <div
        aria-hidden="true"
        className="menu-orbit decor-orb -left-16 top-12 h-40 w-40 decor-orb-gold"
      />
      <div
        aria-hidden="true"
        className="menu-orbit decor-orb -right-10 top-44 h-44 w-44 decor-orb-navy [animation-delay:240ms]"
      />

      <div className="page-container-inner space-y-8">
        <Card
          variant="elevated"
          className="menu-reveal section-hero"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                Guest Checkout
              </div>
              <h1 className="display-font text-5xl leading-tight tracking-tight text-[var(--text-heading)]">
                Pay table {Number.isFinite(tableNumber) ? tableNumber : "?"}
              </h1>
              <p className="text-base leading-relaxed text-secondary">
                Split the bill, add tip, and complete secure payment with
                receipt delivery.
              </p>
            </div>

            <div className="rounded-xl surface-glass-light px-5 py-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                Due now
              </div>
              <div className="display-font mt-1 text-4xl leading-none accent-metal">
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

          <div className="mt-3 rounded-xl surface-glass-light px-3 py-2 text-xs text-secondary">
            {trustMessage}
          </div>
        </Card>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="status-chip status-chip-danger inline-flex"
          >
            {error}
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="status-chip status-chip-neutral inline-flex"
          >
            {statusMessage}
          </div>
        )}

        <Card className="menu-reveal menu-delay-1 space-y-3 section-hero">
          {guidedSplit && (
            <ProgressStepper
              steps={[
                "Payment setup",
                "Customer details",
                "Confirm",
              ]}
              currentStep={guidedStep}
            />
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(!guidedSplit || guidedStep >= 1) && (
            <section className="rounded-xl surface-glass-light p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Payment setup
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <FormInput
                  label="Split count"
                  value={shareCount}
                  inputMode="numeric"
                  error={fieldErrors.shareCount}
                  onChange={event => {
                    setShareCount(event.target.value)
                    setFieldErrors(prev => ({
                      ...prev,
                      shareCount: undefined,
                    }))
                  }}
                />
                <FormInput
                  label="Amount"
                  value={amount}
                  inputMode="decimal"
                  error={fieldErrors.amount}
                  onChange={event => {
                    setAmount(event.target.value)
                    setFieldErrors(prev => ({
                      ...prev,
                      amount: undefined,
                    }))
                  }}
                />
                <FormInput
                  label="Tip %"
                  value={tipPercent}
                  inputMode="numeric"
                  error={fieldErrors.tipPercent}
                  onChange={event => {
                    setTipPercent(event.target.value)
                    setFieldErrors(prev => ({
                      ...prev,
                      tipPercent: undefined,
                    }))
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {tipPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTipPercent(preset)
                        haptic("light")
                        setFieldErrors(prev => ({
                          ...prev,
                          tipPercent: undefined,
                        }))
                      }}
                      className={`btn-press focus-ring action-surface rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                        tipPercent === preset
                          ? "shadow-[0_0_12px_rgba(217,174,63,0.3)]"
                          : "action-surface-muted"
                      }`}
                    >
                      {tipPresetLabel(preset)}
                    </button>
                  ))}
                </div>
                <FormSelect
                  label="Payment method"
                  value={method}
                  onChange={event =>
                    setMethod(
                      event.target.value as
                        | "APPLE_PAY"
                        | "GOOGLE_PAY"
                        | "CARD"
                    )
                  }
                >
                  <option value="CARD">Card</option>
                  <option value="APPLE_PAY">Apple Pay</option>
                  <option value="GOOGLE_PAY">Google Pay</option>
                </FormSelect>
              </div>
            </section>
            )}

            {(!guidedSplit || guidedStep >= 2) && (
            <section className="rounded-xl surface-glass-light p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Customer details
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <FormInput
                  label="Email receipt"
                  value={email}
                  type="email"
                  autoComplete="email"
                  error={fieldErrors.email}
                  onChange={event => {
                    setEmail(event.target.value)
                    setFieldErrors(prev => ({
                      ...prev,
                      email: undefined,
                    }))
                  }}
                />
                <FormInput
                  label="Promo code"
                  list="promo-codes"
                  value={promoCode}
                  onChange={event =>
                    setPromoCode(event.target.value.toUpperCase())
                  }
                />
                <datalist id="promo-codes">
                  {promos.map(promo => (
                    <option key={promo.code} value={promo.code} />
                  ))}
                </datalist>
                <FormInput
                  label="Customer ID (optional)"
                  value={customerId}
                  onChange={event => setCustomerId(event.target.value)}
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <FormInput
                    label="Name"
                    placeholder="Name"
                    value={customerName}
                    onChange={event =>
                      setCustomerName(event.target.value)
                    }
                  />
                  <FormInput
                    label="Phone"
                    placeholder="Phone"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                  />
                  <FormInput
                    label="Redeem points"
                    placeholder="Points"
                    inputMode="numeric"
                    value={redeemPoints}
                    onChange={event =>
                      setRedeemPoints(event.target.value)
                    }
                  />
                </div>
              </div>
            </section>
            )}
          </div>

          <FormCheckbox
            label="Optional: receive marketing updates"
            checked={marketingOptIn}
            onChange={event =>
              setMarketingOptIn(event.target.checked)
            }
          />

          <div className="rounded-[var(--radius-control)] surface-glass-light px-4 py-3 text-base">
            Estimated charge:{" "}
            <span key={estimatedTotal} className="count-up inline-block font-semibold accent-metal">{money(estimatedTotal)}</span>
          </div>

          {strictCheckoutSafety && (
            <div className="space-y-2 rounded-[var(--radius-control)] surface-glass-light px-3 py-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Strict checkout checklist
              </div>
              <FormCheckbox
                label="I confirmed the amount and split details are correct."
                checked={strictAmountConfirmed}
                error={fieldErrors.strictAmountConfirmed}
                onChange={event => {
                  setStrictAmountConfirmed(event.target.checked)
                  setFieldErrors(prev => ({
                    ...prev,
                    strictAmountConfirmed: undefined,
                  }))
                }}
              />
              <FormCheckbox
                label="I confirmed the payment method and receipt details."
                checked={strictMethodConfirmed}
                error={fieldErrors.strictMethodConfirmed}
                onChange={event => {
                  setStrictMethodConfirmed(event.target.checked)
                  setFieldErrors(prev => ({
                    ...prev,
                    strictMethodConfirmed: undefined,
                  }))
                }}
              />
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
            <div className="space-y-2 rounded-[var(--radius-control)] surface-glass-light p-3">
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
          <PaymentCelebration
            receiptId={result.receipt.receiptId}
            totalCharged={result.receipt.totalCharged}
            tipAmount={result.receipt.tipAmount}
            method={result.receipt.method}
            remainingDue={result.bill.dueTotal}
            onDismiss={() => router.push("/menu")}
          />
        )}
      </div>
    </div>
  )
}
