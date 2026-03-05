type StripeApiErrorPayload = {
  error?: {
    message?: string
  }
}

type StripeRequestOptions = {
  stripeAccountId?: string | null
  idempotencyKey?: string | null
}

type ConnectedAccountResponse = {
  id: string
}

type ConnectedAccountLinkResponse = {
  url?: string
}

type StripeCheckoutSessionResponse = {
  id: string
  url?: string
  payment_intent?: string | { id?: string } | null
  amount_total?: number | null
  currency?: string | null
  metadata?: Record<string, string>
}

type StripeSetupIntentResponse = {
  id: string
  payment_method?: string | null
}

type StripeSubscriptionResponse = {
  id: string
  status?: string
}

type StripeInvoiceItemResponse = {
  id: string
}

type StripeInvoiceResponse = {
  id: string
  status?: string
  hosted_invoice_url?: string | null
}

export type StripeCheckoutLineItemInput = {
  name: string
  quantity: number
  unitAmountMinor: number
}

export type StripeDirectCheckoutSessionInput = {
  stripeAccountId: string
  restaurantSlug: string
  orderId: string
  successUrl: string
  cancelUrl: string
  currency: string
  lineItems: StripeCheckoutLineItemInput[]
  totalAmountMinor: number
}

export type StripeDirectCheckoutSessionResult = {
  checkoutSessionId: string
  checkoutUrl: string
  paymentIntentId: string | null
  applicationFeeAmount: number
}

export type StripeConnectedSubscriptionResult = {
  setupIntentId: string
  setupPaymentMethodId: string
  subscriptionId: string
  subscriptionStatus: string
}

export type StripeConnectedSetupFeeResult = {
  invoiceItemId: string
  invoiceId: string
  invoiceStatus: string
  hostedInvoiceUrl: string | null
}

type StripeWebhookEnvelope = {
  id?: string
  type?: string
  account?: string
  data?: {
    object?: unknown
  }
}

function requireStripeSecretKey() {
  const key =
    process.env.STRIPE_SECRET_KEY?.trim() ||
    process.env.PAYMENT_PROVIDER_SECRET?.trim()
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is required (or PAYMENT_PROVIDER_SECRET as fallback)"
    )
  }
  return key
}

function requireStripeSubscriptionPriceId() {
  const priceId = process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID?.trim()
  if (!priceId) {
    throw new Error("STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID is required")
  }
  return priceId
}

function readStripeSetupFeePriceId() {
  const priceId = process.env.STRIPE_SETUP_FEE_PRICE_ID?.trim() ?? ""
  return priceId || null
}

function requireStripeSetupFeePriceId() {
  const priceId = readStripeSetupFeePriceId()
  if (!priceId) {
    throw new Error("STRIPE_SETUP_FEE_PRICE_ID is required for setup fee")
  }
  return priceId
}

function toStripeErrorMessage(
  payload: unknown,
  fallbackStatus: number,
  path: string
) {
  if (payload && typeof payload === "object") {
    const maybe = payload as StripeApiErrorPayload
    if (maybe.error?.message) {
      return maybe.error.message
    }
  }
  return `Stripe request failed (${fallbackStatus}) on ${path}`
}

function withBaseHeaders(options?: StripeRequestOptions) {
  const headers = new Headers()
  headers.set("Authorization", `Bearer ${requireStripeSecretKey()}`)
  if (options?.stripeAccountId) {
    headers.set("Stripe-Account", options.stripeAccountId)
  }
  if (options?.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey)
  }
  return headers
}

async function stripeJsonPost<T>(
  path: string,
  payload: Record<string, unknown>,
  options?: StripeRequestOptions
) {
  const headers = withBaseHeaders(options)
  headers.set("Content-Type", "application/json")

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const data = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error(
      toStripeErrorMessage(data, response.status, path)
    )
  }
  return data as T
}

async function stripeFormPost<T>(
  path: string,
  body: URLSearchParams,
  options?: StripeRequestOptions
) {
  const headers = withBaseHeaders(options)
  headers.set("Content-Type", "application/x-www-form-urlencoded")

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  })

  const data = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error(
      toStripeErrorMessage(data, response.status, path)
    )
  }
  return data as T
}

async function stripeJsonGet<T>(
  path: string,
  options?: StripeRequestOptions
) {
  const headers = withBaseHeaders(options)
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
  })

  const data = (await response.json()) as unknown
  if (!response.ok) {
    throw new Error(
      toStripeErrorMessage(data, response.status, path)
    )
  }
  return data as T
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeCountry(value: string | undefined) {
  const normalized = String(value ?? "GB").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "GB"
}

function normalizeCurrency(value: string) {
  const normalized = value.trim().toLowerCase()
  return /^[a-z]{3}$/.test(normalized) ? normalized : "gbp"
}

function normalizeAmountMinor(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(1, Math.round(value))
}

export function calculateApplicationFeeAmount(totalAmountMinor: number) {
  const normalized = normalizeAmountMinor(totalAmountMinor)
  return Math.round(normalized * 0.02)
}

export async function createConnectedAccountWithOnboardingLink(input: {
  restaurantDisplayName: string
  contactEmail: string
  country?: string
  phone?: string
  refreshUrl: string
  returnUrl: string
}) {
  const displayName = input.restaurantDisplayName.trim()
  const contactEmail = input.contactEmail.trim()
  if (!displayName) {
    throw new Error("restaurant display name is required")
  }
  if (!contactEmail) {
    throw new Error("contact email is required")
  }

  const account = await stripeJsonPost<ConnectedAccountResponse>(
    "/v2/core/accounts",
    {
      display_name: displayName,
      contact_email: contactEmail,
      configuration: {
        merchant: {
          simulate_accept_tos_obo: true,
        },
        customer: {},
      },
      include: [
        "configuration.merchant",
        "configuration.recipient",
        "identity",
        "defaults",
        "configuration.customer",
      ],
      identity: {
        country: normalizeCountry(input.country),
        business_details: {
          phone: input.phone?.trim() || "0000000000",
        },
      },
      dashboard: "full",
      defaults: {
        responsibilities: {
          losses_collector: "stripe",
          fees_collector: "stripe",
        },
      },
    }
  )

  const accountId = String(account.id ?? "").trim()
  if (!accountId) {
    throw new Error("Stripe did not return a connected account id")
  }

  const accountLink = await stripeJsonPost<ConnectedAccountLinkResponse>(
    "/v2/core/account_links",
    {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant", "customer"],
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
        },
      },
    }
  )

  const onboardingUrl = String(accountLink.url ?? "").trim()
  if (!onboardingUrl) {
    throw new Error("Stripe did not return an onboarding url")
  }

  return {
    accountId,
    onboardingUrl,
  }
}

export async function createDirectCheckoutSessionForConnectedAccount(
  input: StripeDirectCheckoutSessionInput
): Promise<StripeDirectCheckoutSessionResult> {
  const lineItems = input.lineItems.filter(
    line =>
      line.name.trim() !== "" &&
      Number.isFinite(line.quantity) &&
      line.quantity > 0 &&
      Number.isFinite(line.unitAmountMinor) &&
      line.unitAmountMinor > 0
  )
  if (lineItems.length === 0) {
    throw new Error("At least one chargeable line item is required")
  }

  const body = new URLSearchParams()
  body.set("mode", "payment")
  body.set("success_url", input.successUrl)
  body.set("cancel_url", input.cancelUrl)
  body.set("payment_method_types[0]", "card")
  body.set("client_reference_id", input.orderId)
  body.set("metadata[restaurant_slug]", input.restaurantSlug)
  body.set("metadata[order_id]", input.orderId)
  body.set("payment_intent_data[metadata][restaurant_slug]", input.restaurantSlug)
  body.set("payment_intent_data[metadata][order_id]", input.orderId)
  body.set("expand[0]", "payment_intent")

  const feeAmount = calculateApplicationFeeAmount(input.totalAmountMinor)
  body.set("payment_intent_data[application_fee_amount]", String(feeAmount))

  lineItems.forEach((line, index) => {
    body.set(
      `line_items[${index}][price_data][currency]`,
      normalizeCurrency(input.currency)
    )
    body.set(
      `line_items[${index}][price_data][product_data][name]`,
      line.name
    )
    body.set(
      `line_items[${index}][price_data][unit_amount]`,
      String(normalizeAmountMinor(line.unitAmountMinor))
    )
    body.set(`line_items[${index}][quantity]`, String(Math.floor(line.quantity)))
  })

  const session = await stripeFormPost<StripeCheckoutSessionResponse>(
    "/v1/checkout/sessions",
    body,
    {
      stripeAccountId: input.stripeAccountId,
      idempotencyKey: `checkout:${input.restaurantSlug}:${input.orderId}`,
    }
  )

  const checkoutSessionId = String(session.id ?? "").trim()
  if (!checkoutSessionId) {
    throw new Error("Stripe did not return a checkout session id")
  }

  const checkoutUrl = String(session.url ?? "").trim()
  if (!checkoutUrl) {
    throw new Error("Stripe did not return a checkout session url")
  }

  const paymentIntentRaw = session.payment_intent
  const paymentIntentId =
    typeof paymentIntentRaw === "string"
      ? paymentIntentRaw
      : typeof paymentIntentRaw === "object" && paymentIntentRaw
        ? String(paymentIntentRaw.id ?? "").trim() || null
        : null

  return {
    checkoutSessionId,
    checkoutUrl,
    paymentIntentId,
    applicationFeeAmount: feeAmount,
  }
}

export async function createConnectedAccountStripeBalanceSubscription(input: {
  restaurantSlug: string
  stripeAccountId: string
  subscriptionPriceId?: string
}) {
  const subscriptionPriceId =
    input.subscriptionPriceId?.trim() ||
    requireStripeSubscriptionPriceId()

  const setupIntentBody = new URLSearchParams()
  setupIntentBody.set("payment_method_types[0]", "stripe_balance")
  setupIntentBody.set("confirm", "true")
  setupIntentBody.set("customer_account", input.stripeAccountId)
  setupIntentBody.set("usage", "off_session")
  setupIntentBody.set("payment_method_data[type]", "stripe_balance")
  setupIntentBody.set("metadata[restaurant_slug]", input.restaurantSlug)

  const setupIntent = await stripeFormPost<StripeSetupIntentResponse>(
    "/v1/setup_intents",
    setupIntentBody,
    {
      idempotencyKey: `setup-intent:${input.restaurantSlug}:${input.stripeAccountId}`,
    }
  )

  const setupPaymentMethodId = String(
    setupIntent.payment_method ?? ""
  ).trim()
  if (!setupPaymentMethodId) {
    throw new Error("Stripe did not return a setup payment method")
  }

  const subscriptionBody = new URLSearchParams()
  subscriptionBody.set("customer_account", input.stripeAccountId)
  subscriptionBody.set("default_payment_method", setupPaymentMethodId)
  subscriptionBody.set("items[0][price]", subscriptionPriceId)
  subscriptionBody.set("items[0][quantity]", "1")
  subscriptionBody.set(
    "payment_settings[payment_method_types][0]",
    "stripe_balance"
  )
  subscriptionBody.set("metadata[restaurant_slug]", input.restaurantSlug)

  const subscription = await stripeFormPost<StripeSubscriptionResponse>(
    "/v1/subscriptions",
    subscriptionBody,
    {
      idempotencyKey: `subscription:${input.restaurantSlug}:${input.stripeAccountId}`,
    }
  )

  const subscriptionId = String(subscription.id ?? "").trim()
  if (!subscriptionId) {
    throw new Error("Stripe did not return a subscription id")
  }

  return {
    setupIntentId: setupIntent.id,
    setupPaymentMethodId,
    subscriptionId,
    subscriptionStatus: String(subscription.status ?? "active")
      .trim()
      .toUpperCase(),
  } satisfies StripeConnectedSubscriptionResult
}

export async function createConnectedAccountSetupFee(input: {
  restaurantSlug: string
  stripeAccountId: string
  setupFeePriceId?: string
}) {
  const setupFeePriceId =
    input.setupFeePriceId?.trim() ||
    requireStripeSetupFeePriceId()

  const invoiceItemBody = new URLSearchParams()
  invoiceItemBody.set("customer_account", input.stripeAccountId)
  invoiceItemBody.set("price", setupFeePriceId)
  invoiceItemBody.set("metadata[restaurant_slug]", input.restaurantSlug)
  invoiceItemBody.set("description", "Platform setup fee")

  const invoiceItem = await stripeFormPost<StripeInvoiceItemResponse>(
    "/v1/invoiceitems",
    invoiceItemBody,
    {
      idempotencyKey: `setup-fee-item:${input.restaurantSlug}:${input.stripeAccountId}`,
    }
  )

  const invoiceBody = new URLSearchParams()
  invoiceBody.set("customer_account", input.stripeAccountId)
  invoiceBody.set("collection_method", "charge_automatically")
  invoiceBody.set("auto_advance", "true")
  invoiceBody.set("metadata[restaurant_slug]", input.restaurantSlug)

  const invoice = await stripeFormPost<StripeInvoiceResponse>(
    "/v1/invoices",
    invoiceBody,
    {
      idempotencyKey: `setup-fee-invoice:${input.restaurantSlug}:${input.stripeAccountId}`,
    }
  )

  return {
    invoiceItemId: invoiceItem.id,
    invoiceId: invoice.id,
    invoiceStatus: String(invoice.status ?? "open")
      .trim()
      .toUpperCase(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
  } satisfies StripeConnectedSetupFeeResult
}

function extractStripeEventObjectId(object: unknown) {
  if (typeof object === "string") {
    return object.trim() || null
  }
  if (object && typeof object === "object") {
    const id = String((object as { id?: unknown }).id ?? "").trim()
    if (id) return id
  }
  return null
}

export function parseStripeWebhookEnvelope(payload: string) {
  const parsed = JSON.parse(payload) as StripeWebhookEnvelope
  return {
    id: String(parsed.id ?? "").trim(),
    type: String(parsed.type ?? "").trim(),
    account: String(parsed.account ?? "").trim() || null,
    object: parsed.data?.object,
    objectId: extractStripeEventObjectId(parsed.data?.object),
  }
}

export async function fetchStripeCheckoutSession(input: {
  checkoutSessionId: string
  stripeAccountId?: string | null
}) {
  return stripeJsonGet<StripeCheckoutSessionResponse>(
    `/v1/checkout/sessions/${encodeURIComponent(input.checkoutSessionId)}?expand[]=payment_intent`,
    {
      stripeAccountId: input.stripeAccountId ?? null,
    }
  )
}

export async function fetchStripeInvoice(invoiceId: string) {
  return stripeJsonGet<Record<string, unknown>>(
    `/v1/invoices/${encodeURIComponent(invoiceId)}`
  )
}

export async function fetchStripeSubscription(subscriptionId: string) {
  return stripeJsonGet<Record<string, unknown>>(
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`
  )
}

export async function fetchStripePaymentIntent(paymentIntentId: string) {
  return stripeJsonGet<Record<string, unknown>>(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`
  )
}

export async function fetchStripeCharge(chargeId: string) {
  return stripeJsonGet<Record<string, unknown>>(
    `/v1/charges/${encodeURIComponent(chargeId)}`
  )
}

export async function fetchStripeV2CoreAccount(accountId: string) {
  return stripeJsonGet<Record<string, unknown>>(
    `/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.merchant&include[]=configuration.recipient&include[]=requirements`
  )
}

export function extractPaymentIntentIdFromCheckoutSession(
  session: Record<string, unknown>
) {
  const paymentIntent = session.payment_intent
  if (typeof paymentIntent === "string") {
    return paymentIntent.trim() || null
  }
  if (paymentIntent && typeof paymentIntent === "object") {
    return String(
      (paymentIntent as { id?: unknown }).id ?? ""
    ).trim() || null
  }
  return null
}

export function readStripeMetadata(
  object: Record<string, unknown>
) {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {}
  const asText = (key: string) =>
    String(metadata[key] ?? "")
      .trim()
  return {
    restaurantSlug:
      asText("restaurant_slug").toLowerCase() || null,
    orderId: asText("order_id") || null,
  }
}

export function parseConnectedAccountStatusFromV2Account(
  account: Record<string, unknown>
) {
  const configuration =
    account.configuration && typeof account.configuration === "object"
      ? (account.configuration as Record<string, unknown>)
      : {}
  const recipient =
    configuration.recipient && typeof configuration.recipient === "object"
      ? (configuration.recipient as Record<string, unknown>)
      : {}
  const recipientCapabilities =
    recipient.capabilities && typeof recipient.capabilities === "object"
      ? (recipient.capabilities as Record<string, unknown>)
      : {}
  const stripeBalance =
    recipientCapabilities.stripe_balance &&
    typeof recipientCapabilities.stripe_balance === "object"
      ? (recipientCapabilities.stripe_balance as Record<string, unknown>)
      : {}
  const stripeTransfers =
    stripeBalance.stripe_transfers &&
    typeof stripeBalance.stripe_transfers === "object"
      ? (stripeBalance.stripe_transfers as Record<string, unknown>)
      : {}
  const transferStatus = String(stripeTransfers.status ?? "")
    .trim()
    .toLowerCase()

  const requirements =
    account.requirements && typeof account.requirements === "object"
      ? (account.requirements as Record<string, unknown>)
      : {}
  const summary =
    requirements.summary && typeof requirements.summary === "object"
      ? (requirements.summary as Record<string, unknown>)
      : {}
  const minimumDeadline =
    summary.minimum_deadline &&
    typeof summary.minimum_deadline === "object"
      ? (summary.minimum_deadline as Record<string, unknown>)
      : {}
  const requirementStatus = String(minimumDeadline.status ?? "")
    .trim()
    .toLowerCase()

  const payoutsEnabled = transferStatus === "active"
  const chargesEnabled = transferStatus === "active"
  const detailsSubmitted =
    requirementStatus !== "currently_due" &&
    requirementStatus !== "past_due"

  const status = chargesEnabled && payoutsEnabled
    ? "CONNECTED"
    : detailsSubmitted
      ? "RESTRICTED"
      : "PENDING"

  return {
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    status,
  } as const
}

export function extractStripeAccountIdFromEventObject(
  object: unknown
) {
  const id = extractStripeEventObjectId(object)
  if (!id) return null
  return isUuidLike(id) ? null : id
}

export function hasSetupFeePriceConfigured() {
  return readStripeSetupFeePriceId() !== null
}
