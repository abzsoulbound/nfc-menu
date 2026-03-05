import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getPaymentMode,
  isExternalPaymentsRequired,
} from "@/lib/env"
import type { RestaurantProfile } from "@/lib/restaurants"
import type { PreparedCustomerCheckoutInput } from "@/lib/runtimeStore"
import { normalizeRestaurantSlug } from "@/lib/tenant"

export type PaymentChargeInput = {
  amount: number
  currency: string
  reference: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export type PaymentChargeResult = {
  provider: string
  providerRef: string
  status: "SETTLED" | "AUTHORIZED"
  mode: "SIMULATED" | "EXTERNAL"
}

export interface PaymentProviderAdapter {
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>
}

export type RecoveredExternalCheckout = {
  restaurantSlug: string
  checkout: {
    tableNumber: number
    shareCount?: number
    amount?: number
    tipPercent?: number
    method: "APPLE_PAY" | "GOOGLE_PAY" | "CARD"
    email?: string | null
    promoCode?: string | null
    customerId?: string | null
    customerName?: string | null
    phone?: string | null
    marketingOptIn?: boolean
    redeemPoints?: number
    idempotencyKey?: string
  }
  preparedCheckout: PreparedCustomerCheckoutInput
  providerResult: PaymentChargeResult
  paymentIntentId: string
  status: string
}

type StripePaymentIntent = {
  id: string
  client_secret?: string
  status: string
  amount: number
  currency: string
  metadata?: Record<string, string>
}

type StripeConnectedAccount = {
  id: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

type StripeCheckoutSession = {
  id: string
  url?: string
  customer?: string | null
  subscription?: string | null
  status?: string
}

type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

function deterministicProviderRef(prefix: string, input: PaymentChargeInput) {
  const raw = `${prefix}:${input.reference}:${input.idempotencyKey}:${input.amount}:${input.currency}`
  return `${prefix}_${createHash("sha256").update(raw).digest("hex").slice(0, 18)}`
}

function normalizeExternalProvider() {
  const raw = process.env.PAYMENT_PROVIDER?.trim().toUpperCase() ?? ""
  if (
    raw === "STRIPE" ||
    raw === "STRIPE_CONNECT" ||
    raw === "STRIPE_CONNECT_STANDARD" ||
    raw === "STRIPE_CONNECT_DESTINATION"
  ) {
    return "STRIPE_CONNECT_STANDARD"
  }
  return raw
}

function requireStripeSecretKey() {
  const value = process.env.PAYMENT_PROVIDER_SECRET?.trim()
  if (!value) {
    throw new Error("PAYMENT_PROVIDER_SECRET is required for Stripe")
  }
  return value
}

function requireStripePublishableKey() {
  const value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  if (!value) {
    throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required for Stripe")
  }
  return value
}

function requireStripeConnectClientId() {
  const value = process.env.STRIPE_CONNECT_CLIENT_ID?.trim()
  if (!value) {
    throw new Error("STRIPE_CONNECT_CLIENT_ID is required for Stripe Connect")
  }
  return value
}

function requireStripeConnectRedirectUri() {
  const value = process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI?.trim()
  if (!value) {
    throw new Error(
      "STRIPE_CONNECT_OAUTH_REDIRECT_URI is required for Stripe Connect"
    )
  }
  return value
}

function requireStripeWebhookSecret() {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!value) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for Stripe webhooks")
  }
  return value
}

function requireStripeSubscriptionPriceId() {
  const value = process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID?.trim()
  if (!value) {
    throw new Error(
      "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID is required for Stripe Billing"
    )
  }
  return value
}

function simulatedProvider(): PaymentProviderAdapter {
  return {
    async charge(input) {
      return {
        provider: "SIMULATED",
        providerRef: deterministicProviderRef("sim", input),
        status: "SETTLED",
        mode: "SIMULATED",
      }
    },
  }
}

function externalIntentOnlyProvider(): PaymentProviderAdapter {
  const provider = normalizeExternalProvider()

  if (!provider || !process.env.PAYMENT_PROVIDER_SECRET?.trim()) {
    throw new Error("External payment provider is not configured")
  }

  return {
    async charge() {
      throw new Error(
        "External production tenants must create a PaymentIntent before checkout finalization"
      )
    },
  }
}

export function getPaymentProviderAdapterForTenant(input: {
  isDemo: boolean
}) {
  if (input.isDemo) {
    return simulatedProvider()
  }

  return getPaymentMode() === "EXTERNAL"
    ? externalIntentOnlyProvider()
    : simulatedProvider()
}

export function assertPaymentsAllowedForTenant(input: {
  isDemo: boolean
}) {
  if (!isExternalPaymentsRequired()) return
  if (input.isDemo) return
  if (getPaymentMode() !== "EXTERNAL") {
    throw new Error(
      "External payments are required for non-demo tenants"
    )
  }
}

export function readIdempotencyKey(req: Request, bodyKey?: string) {
  const headerKey = req.headers.get("idempotency-key")?.trim() ?? ""
  const body = bodyKey?.trim() ?? ""
  return headerKey || body || ""
}

export function withStripeConnectHeaders(input?: {
  headers?: HeadersInit
  stripeAccountId?: string | null
  idempotencyKey?: string | null
}) {
  const headers = new Headers(input?.headers)
  headers.set("Authorization", `Bearer ${requireStripeSecretKey()}`)
  if (input?.stripeAccountId) {
    headers.set("Stripe-Account", input.stripeAccountId)
  }
  if (input?.idempotencyKey) {
    headers.set("Idempotency-Key", input.idempotencyKey)
  }
  return headers
}

async function stripeFormRequest<T>(
  path: string,
  body: URLSearchParams,
  input?: {
    stripeAccountId?: string | null
    idempotencyKey?: string | null
  }
) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: withStripeConnectHeaders({
      stripeAccountId: input?.stripeAccountId,
      idempotencyKey: input?.idempotencyKey,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }),
    body,
    cache: "no-store",
  })

  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    const stripeMessage =
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : `Stripe request failed (${response.status})`
    throw new Error(stripeMessage)
  }

  return payload as T
}

async function stripeJsonRequest<T>(
  path: string,
  input?: {
    stripeAccountId?: string | null
  }
) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "GET",
    headers: withStripeConnectHeaders({
      stripeAccountId: input?.stripeAccountId,
    }),
    cache: "no-store",
  })

  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    const stripeMessage =
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : `Stripe request failed (${response.status})`
    throw new Error(stripeMessage)
  }

  return payload as T
}

function toMinorUnits(amount: number) {
  return Math.max(1, Math.round(amount * 100))
}

function toApplicationFeeAmount(totalMinorUnits: number, feeBps: number) {
  if (!Number.isFinite(feeBps) || feeBps <= 0) return 0
  return Math.max(
    0,
    Math.round(totalMinorUnits * (Math.min(10000, feeBps) / 10000))
  )
}

function buildPaymentIntentMetadata(input: {
  restaurant: RestaurantProfile
  prepared: PreparedCustomerCheckoutInput
}) {
  const metadata: Record<string, string> = {
    restaurant_slug: input.restaurant.slug,
    table_id: input.prepared.tableId,
    table_number: String(input.prepared.tableNumber),
    amount: input.prepared.amount.toFixed(2),
    tip_amount: input.prepared.tipAmount.toFixed(2),
    total_charged: input.prepared.totalCharged.toFixed(2),
    method: input.prepared.method,
    marketing_opt_in: input.prepared.marketingOptIn ? "true" : "false",
    redeemed_points: String(
      Math.max(0, Math.floor(input.prepared.redeemedPoints ?? 0))
    ),
    loyalty_earned_points: String(
      Math.max(0, Math.floor(input.prepared.loyaltyEarnedPoints ?? 0))
    ),
    promo_discount: Number(
      (input.prepared.promoDiscount ?? 0).toFixed(2)
    ).toFixed(2),
  }

  if (input.prepared.email) {
    metadata.email = input.prepared.email
  }
  if (input.prepared.promoCode) {
    metadata.promo_code = input.prepared.promoCode
  }
  if (input.prepared.customerId) {
    metadata.customer_id = input.prepared.customerId
  }
  if (input.prepared.customerName) {
    metadata.customer_name = input.prepared.customerName
  }
  if (input.prepared.phone) {
    metadata.phone = input.prepared.phone
  }
  if (input.prepared.idempotencyKey) {
    metadata.idempotency_key = input.prepared.idempotencyKey
  }
  if (input.restaurant.payment.stripeAccountId) {
    metadata.connected_account_id = input.restaurant.payment.stripeAccountId
  }

  return metadata
}

export async function createExternalCheckoutIntent(input: {
  restaurant: RestaurantProfile
  prepared: PreparedCustomerCheckoutInput
}) {
  assertPaymentsAllowedForTenant({
    isDemo: input.restaurant.isDemo,
  })

  const provider = normalizeExternalProvider()
  if (provider !== "STRIPE_CONNECT_STANDARD") {
    throw new Error("Only Stripe Connect Standard is implemented")
  }
  if (input.restaurant.isDemo) {
    throw new Error("Demo tenants use simulated checkout, not Stripe")
  }
  if (!input.restaurant.payment.stripeAccountId) {
    throw new Error("Restaurant has not connected Stripe yet")
  }
  if (!input.restaurant.payment.chargesEnabled) {
    throw new Error("Restaurant Stripe account is not ready to accept charges")
  }

  const amountMinorUnits = toMinorUnits(input.prepared.totalCharged)
  const applicationFeeAmount = toApplicationFeeAmount(
    amountMinorUnits,
    input.restaurant.payment.platformFeeBps
  )

  const body = new URLSearchParams()
  body.set("amount", String(amountMinorUnits))
  body.set("currency", "gbp")
  body.set("automatic_payment_methods[enabled]", "true")
  body.set(
    "transfer_data[destination]",
    input.restaurant.payment.stripeAccountId
  )
  body.set(
    "description",
    `${input.restaurant.name} table ${input.prepared.tableNumber}`
  )
  if (input.prepared.email) {
    body.set("receipt_email", input.prepared.email)
  }
  if (applicationFeeAmount > 0) {
    body.set("application_fee_amount", String(applicationFeeAmount))
  }

  const metadata = buildPaymentIntentMetadata(input)
  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value)
  }

  const paymentIntent = await stripeFormRequest<StripePaymentIntent>(
    "/v1/payment_intents",
    body,
    {
      idempotencyKey: input.prepared.idempotencyKey
        ? `intent:${input.prepared.idempotencyKey}`
        : null,
    }
  )

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a client secret")
  }

  return {
    provider: provider,
    mode: "EXTERNAL" as const,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
    amount: input.prepared.totalCharged,
    currency: "GBP",
    stripeAccountId: input.restaurant.payment.stripeAccountId,
    publishableKey: requireStripePublishableKey(),
    applicationFeeAmount: Number((applicationFeeAmount / 100).toFixed(2)),
  }
}

export function createStripeConnectAuthorizeUrl(input: {
  restaurantSlug: string
  actorId?: string | null
}) {
  if (normalizeExternalProvider() !== "STRIPE_CONNECT_STANDARD") {
    throw new Error("Stripe Connect is not the configured payment provider")
  }

  const state = signStripeConnectState({
    restaurantSlug: input.restaurantSlug,
    actorId: input.actorId ?? null,
  })

  const url = new URL("https://connect.stripe.com/oauth/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", requireStripeConnectClientId())
  url.searchParams.set("scope", "read_write")
  url.searchParams.set("redirect_uri", requireStripeConnectRedirectUri())
  url.searchParams.set("state", state)

  return {
    url: url.toString(),
    state,
  }
}

function stripeConnectStateSecret() {
  const secret = process.env.SYSTEM_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("SYSTEM_AUTH_SECRET is required for Stripe Connect state")
  }
  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signStripeConnectState(input: {
  restaurantSlug: string
  actorId?: string | null
}) {
  const restaurantSlug =
    normalizeRestaurantSlug(input.restaurantSlug)
  if (!restaurantSlug) {
    throw new Error("Invalid restaurant slug for Stripe Connect state")
  }

  const payload = JSON.stringify({
    restaurantSlug,
    actorId: input.actorId ?? null,
    issuedAt: Date.now(),
  })
  const encoded = toBase64Url(payload)
  const signature = createHmac("sha256", stripeConnectStateSecret())
    .update(encoded)
    .digest("hex")

  return `${encoded}.${signature}`
}

export function verifyStripeConnectState(token: string) {
  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) {
    throw new Error("Invalid Stripe Connect state")
  }

  const expected = createHmac("sha256", stripeConnectStateSecret())
    .update(encoded)
    .digest("hex")
  const expectedBuffer = Buffer.from(expected, "utf8")
  const signatureBuffer = Buffer.from(signature, "utf8")
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Invalid Stripe Connect state")
  }

  const parsed = JSON.parse(fromBase64Url(encoded)) as {
    restaurantSlug?: string
    actorId?: string | null
    issuedAt?: number
  }
  const restaurantSlug = normalizeRestaurantSlug(parsed.restaurantSlug)

  if (
    !restaurantSlug ||
    !Number.isFinite(parsed.issuedAt) ||
    Date.now() - Number(parsed.issuedAt) > 1000 * 60 * 30
  ) {
    throw new Error("Expired Stripe Connect state")
  }

  return {
    restaurantSlug,
    actorId: parsed.actorId ?? null,
  }
}

export async function exchangeStripeConnectCode(input: { code: string }) {
  if (normalizeExternalProvider() !== "STRIPE_CONNECT_STANDARD") {
    throw new Error("Stripe Connect is not the configured payment provider")
  }

  const body = new URLSearchParams()
  body.set("client_secret", requireStripeSecretKey())
  body.set("code", input.code)
  body.set("grant_type", "authorization_code")

  const response = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })

  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    const stripeMessage =
      typeof payload.error_description === "string"
        ? payload.error_description
        : "Stripe Connect OAuth failed"
    throw new Error(stripeMessage)
  }

  const stripeAccountId = String(payload.stripe_user_id ?? "").trim()
  if (!stripeAccountId) {
    throw new Error("Stripe Connect did not return an account id")
  }

  return {
    stripeAccountId,
  }
}

export async function fetchStripeConnectedAccount(input: {
  stripeAccountId: string
}): Promise<{
  stripeAccountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  status: "PENDING" | "RESTRICTED" | "CONNECTED"
}> {
  const account = await stripeJsonRequest<StripeConnectedAccount>(
    `/v1/accounts/${input.stripeAccountId}`
  )

  return {
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    status:
      account.charges_enabled && account.payouts_enabled
        ? "CONNECTED"
        : account.details_submitted
          ? "RESTRICTED"
          : "PENDING",
  }
}

export async function createStripeBillingCustomer(input: {
  restaurant: RestaurantProfile
}) {
  const body = new URLSearchParams()
  body.set("name", input.restaurant.name)
  body.set("metadata[restaurant_slug]", input.restaurant.slug)
  body.set("metadata[plan_tier]", input.restaurant.planTier)

  const customer = await stripeFormRequest<{
    id: string
  }>("/v1/customers", body)

  return {
    stripeCustomerId: customer.id,
  }
}

export async function createStripeBillingSubscriptionCheckout(input: {
  restaurant: RestaurantProfile
  stripeCustomerId: string
  successUrl: string
  cancelUrl: string
}) {
  const body = new URLSearchParams()
  body.set("mode", "subscription")
  body.set("customer", input.stripeCustomerId)
  body.set("line_items[0][price]", requireStripeSubscriptionPriceId())
  body.set("line_items[0][quantity]", "1")
  body.set("success_url", input.successUrl)
  body.set("cancel_url", input.cancelUrl)
  body.set("metadata[restaurant_slug]", input.restaurant.slug)
  body.set("subscription_data[metadata][restaurant_slug]", input.restaurant.slug)

  const session = await stripeFormRequest<StripeCheckoutSession>(
    "/v1/checkout/sessions",
    body,
    {
      idempotencyKey: `billing:${input.restaurant.slug}:${input.stripeCustomerId}`,
    }
  )

  if (!session.url) {
    throw new Error("Stripe did not return a subscription checkout URL")
  }

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
  }
}

function asStripeObjectRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }
  return value as Record<string, unknown>
}

function readRestaurantSlugFromStripeMetadata(value: unknown) {
  const metadata = asStripeObjectRecord(value)
  if (!metadata) return null
  return normalizeRestaurantSlug(
    String(metadata.restaurant_slug ?? "").trim()
  )
}

function findRestaurantSlugInStripeBillingObject(
  object: Record<string, unknown>
) {
  const direct = readRestaurantSlugFromStripeMetadata(object.metadata)
  if (direct) return direct

  const subscriptionDetails = asStripeObjectRecord(
    object.subscription_details
  )
  const subscriptionDetailsSlug = readRestaurantSlugFromStripeMetadata(
    subscriptionDetails?.metadata
  )
  if (subscriptionDetailsSlug) {
    return subscriptionDetailsSlug
  }

  const parent = asStripeObjectRecord(object.parent)
  const parentSubscriptionDetails = asStripeObjectRecord(
    parent?.subscription_details
  )
  const parentSubscriptionSlug = readRestaurantSlugFromStripeMetadata(
    parentSubscriptionDetails?.metadata
  )
  if (parentSubscriptionSlug) {
    return parentSubscriptionSlug
  }

  const lines = asStripeObjectRecord(object.lines)
  const lineItems = Array.isArray(lines?.data) ? lines.data : []
  for (const lineItem of lineItems) {
    const lineRecord = asStripeObjectRecord(lineItem)
    const lineSlug = readRestaurantSlugFromStripeMetadata(
      lineRecord?.metadata
    )
    if (lineSlug) {
      return lineSlug
    }
  }

  return null
}

export function extractStripeBillingState(input: {
  object: Record<string, unknown>
}) {
  const object = input.object
  const restaurantSlug = findRestaurantSlugInStripeBillingObject(object)
  const stripeAccountId =
    String(object.customer_account ?? "").trim() || null
  const stripeCustomerId =
    String(object.customer ?? object.customer_account ?? "").trim() ||
    null
  const stripeSubscriptionId =
    String(object.subscription ?? "").trim() ||
    String(object.id ?? "").trim() ||
    null
  const subscriptionStatus = String(object.status ?? "").trim().toUpperCase()

  return {
    restaurantSlug,
    stripeAccountId,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus: subscriptionStatus || "INACTIVE",
  }
}

function parseNumber(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBoolean(value: string | undefined) {
  return value === "true"
}

export function extractRecoveredExternalCheckout(
  paymentIntent: StripePaymentIntent
): RecoveredExternalCheckout {
  const metadata = paymentIntent.metadata ?? {}
  const restaurantSlug = String(metadata.restaurant_slug ?? "").trim()
  const tableNumber = parseNumber(metadata.table_number)
  const amount = parseNumber(metadata.amount)
  const tipAmount = parseNumber(metadata.tip_amount)
  const paymentMethod = String(metadata.method ?? "CARD").trim()
  const method =
    paymentMethod === "APPLE_PAY" || paymentMethod === "GOOGLE_PAY"
      ? paymentMethod
      : "CARD"

  if (!restaurantSlug || !Number.isFinite(tableNumber) || tableNumber <= 0) {
    throw new Error("Stripe payment intent is missing checkout metadata")
  }

  return {
    restaurantSlug,
    checkout: {
      tableNumber,
      amount,
      tipPercent:
        amount > 0 ? Number(((tipAmount / amount) * 100).toFixed(2)) : 0,
      method,
      email: metadata.email ?? null,
      promoCode: metadata.promo_code ?? null,
      customerId: metadata.customer_id ?? null,
      customerName: metadata.customer_name ?? null,
      phone: metadata.phone ?? null,
      marketingOptIn: parseBoolean(metadata.marketing_opt_in),
      redeemPoints: parseNumber(metadata.redeemed_points),
      idempotencyKey: metadata.idempotency_key ?? undefined,
    },
    preparedCheckout: {
      tableId: "",
      tableNumber,
      amount,
      tipAmount,
      totalCharged: parseNumber(metadata.total_charged),
      method,
      email: metadata.email ?? null,
      promoCode: metadata.promo_code ?? null,
      promoDiscount: parseNumber(metadata.promo_discount),
      customerId: metadata.customer_id ?? null,
      customerName: metadata.customer_name ?? null,
      phone: metadata.phone ?? null,
      marketingOptIn: parseBoolean(metadata.marketing_opt_in),
      redeemedPoints: parseNumber(metadata.redeemed_points),
      loyaltyEarnedPoints: parseNumber(metadata.loyalty_earned_points),
      idempotencyKey: metadata.idempotency_key ?? undefined,
    },
    providerResult: {
      provider: "STRIPE_CONNECT_STANDARD",
      providerRef: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "SETTLED" : "AUTHORIZED",
      mode: "EXTERNAL",
    },
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  }
}

export async function fetchStripePaymentIntentForRestaurant(input: {
  restaurant: RestaurantProfile
  paymentIntentId: string
}) {
  const stripeAccountId = input.restaurant.payment.stripeAccountId
  if (!stripeAccountId) {
    throw new Error("Restaurant has not connected Stripe yet")
  }

  const paymentIntent = await stripeJsonRequest<StripePaymentIntent>(
    `/v1/payment_intents/${input.paymentIntentId}`
  )

  const destinationAccountId = String(
    paymentIntent.metadata?.connected_account_id ?? ""
  ).trim()
  if (!destinationAccountId || destinationAccountId !== stripeAccountId) {
    throw new Error("Payment intent does not belong to this restaurant")
  }

  return extractRecoveredExternalCheckout(paymentIntent)
}

export function verifyAndParseStripeWebhook(input: {
  payload: string
  signatureHeader: string | null
}) {
  const signatureHeader = input.signatureHeader?.trim()
  if (!signatureHeader) {
    throw new Error("Missing Stripe signature")
  }

  const parts = signatureHeader
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
  const timestampPart = parts.find(part => part.startsWith("t="))
  const signatures = parts
    .filter(part => part.startsWith("v1="))
    .map(part => part.slice(3))
    .filter(Boolean)
  if (!timestampPart || signatures.length === 0) {
    throw new Error("Invalid Stripe signature")
  }

  const timestamp = timestampPart.slice(2)
  const signedPayload = `${timestamp}.${input.payload}`
  const expected = createHmac("sha256", requireStripeWebhookSecret())
    .update(signedPayload)
    .digest("hex")

  const expectedBuffer = Buffer.from(expected, "utf8")
  const hasValidSignature = signatures.some(signature => {
    const signatureBuffer = Buffer.from(signature, "utf8")
    return (
      expectedBuffer.length === signatureBuffer.length &&
      timingSafeEqual(expectedBuffer, signatureBuffer)
    )
  })
  if (!hasValidSignature) {
    throw new Error("Invalid Stripe signature")
  }

  const timestampMs = Number(timestamp) * 1000
  if (!Number.isFinite(timestampMs)) {
    throw new Error("Invalid Stripe signature timestamp")
  }
  if (Math.abs(Date.now() - timestampMs) > 1000 * 60 * 5) {
    throw new Error("Expired Stripe webhook signature")
  }

  return JSON.parse(input.payload) as StripeWebhookEvent
}

export async function appendPaymentLedgerEvent(input: {
  restaurantSlug: string
  tableNumber: number
  receiptId?: string | null
  eventType: string
  amount: number
  currency?: string
  method?: string | null
  provider?: string | null
  providerRef?: string | null
  reason?: string | null
  actorRole?: string | null
  actorId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!process.env.DATABASE_URL) return
  try {
    await prisma.paymentLedgerEvent.create({
      data: {
        restaurantSlug: input.restaurantSlug,
        tableNumber: input.tableNumber,
        receiptId: input.receiptId ?? null,
        eventType: input.eventType,
        amount: Number(input.amount.toFixed(2)),
        currency: input.currency ?? "GBP",
        method: input.method ?? null,
        provider: input.provider ?? null,
        providerRef: input.providerRef ?? null,
        reason: input.reason ?? null,
        actorRole: input.actorRole ?? null,
        actorId: input.actorId ?? null,
        metadata:
          (input.metadata as Prisma.InputJsonValue | undefined) ??
          undefined,
      },
    })
  } catch {
    // Ledger writes should not block checkout flow.
  }
}
