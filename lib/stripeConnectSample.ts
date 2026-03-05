import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

const SAMPLE_APPLICATION_FEE_BPS = 1_000

export type StripeConnectSampleSellerStatus = {
  accountId: string
  readyToReceivePayments: boolean
  onboardingComplete: boolean
  transfersStatus: string
  requirementsStatus: string
}

export type StripeConnectSampleSellerRecord = {
  id: string
  displayName: string
  contactEmail: string
  country: string
  stripeAccountId: string
  createdAt: string
  updatedAt: string
  status: StripeConnectSampleSellerStatus
}

export type StripeConnectSampleProductRecord = {
  id: string
  sellerId: string
  sellerDisplayName: string
  sellerStripeAccountId: string
  stripeProductId: string
  stripePriceId: string
  name: string
  description: string | null
  unitAmount: number
  currency: string
  createdAt: string
  updatedAt: string
}

function requireStripeSampleSecretKey() {
  // The sample defaults to STRIPE_SAMPLE_SECRET_KEY so it can be isolated from
  // the rest of the app. As a fallback it can reuse PAYMENT_PROVIDER_SECRET if
  // you already set that for the rest of the platform.
  const apiKey =
    process.env.STRIPE_SAMPLE_SECRET_KEY?.trim() ||
    process.env.PAYMENT_PROVIDER_SECRET?.trim()

  if (!apiKey) {
    throw new Error(
      "Missing Stripe secret key for the Connect sample. Set STRIPE_SAMPLE_SECRET_KEY (preferred) or PAYMENT_PROVIDER_SECRET before using /connect-demo."
    )
  }

  return apiKey
}

function requireStripeSampleWebhookSecret() {
  const secret =
    process.env.STRIPE_SAMPLE_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!secret) {
    throw new Error(
      "Missing Stripe webhook secret for the Connect sample. Set STRIPE_SAMPLE_WEBHOOK_SECRET (preferred) or STRIPE_WEBHOOK_SECRET before receiving thin events."
    )
  }

  return secret
}

export function getStripeSampleClient() {
  // The user explicitly asked for a single Stripe Client instance to be used
  // for all Stripe requests. We therefore centralize client creation here and
  // do not set apiVersion manually; the installed SDK version pins its own API.
  const stripeClient = new Stripe(requireStripeSampleSecretKey())
  return stripeClient
}

function toCurrency(value: string | undefined) {
  const normalized = String(value ?? "usd").trim().toLowerCase()
  return /^[a-z]{3}$/.test(normalized) ? normalized : "usd"
}

function toPositiveInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be a positive integer in the smallest currency unit")
  }
  return Math.round(value)
}

function formatSellerStatus(input: {
  stripeAccountId: string
  account: Stripe.V2.Core.Account
}): StripeConnectSampleSellerStatus {
  // We deliberately compute onboarding status from the live Stripe API response
  // every time instead of persisting it locally. This matches the user's
  // requirement to always read current status directly from Stripe.
  const transfersStatus =
    input.account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? "unknown"
  const requirementsStatus =
    input.account.requirements?.summary?.minimum_deadline?.status ?? "none"

  return {
    accountId: input.stripeAccountId,
    readyToReceivePayments: transfersStatus === "active",
    onboardingComplete:
      requirementsStatus !== "currently_due" &&
      requirementsStatus !== "past_due",
    transfersStatus,
    requirementsStatus,
  }
}

async function fetchLiveSellerStatus(input: {
  stripeClient: Stripe
  stripeAccountId: string
}) {
  const account = await input.stripeClient.v2.core.accounts.retrieve(
    input.stripeAccountId,
    {
      include: ["configuration.recipient", "requirements"],
    }
  )

  return formatSellerStatus({
    stripeAccountId: input.stripeAccountId,
    account,
  })
}

export async function createStripeConnectSampleSeller(input: {
  displayName: string
  contactEmail: string
}) {
  const displayName = input.displayName.trim()
  const contactEmail = input.contactEmail.trim().toLowerCase()

  if (!displayName) {
    throw new Error("displayName is required")
  }
  if (!contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    throw new Error("contactEmail must be a valid email address")
  }

  const stripeClient = getStripeSampleClient()

  // Account creation intentionally uses only the fields requested by the user.
  // We do not set top-level type here because the V2 API uses dashboard and
  // configuration blocks instead of the legacy account type field.
  const account = await stripeClient.v2.core.accounts.create({
    display_name: displayName,
    contact_email: contactEmail,
    identity: {
      country: "gb",
    },
    dashboard: "express",
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
  })

  const saved = await prisma.stripeConnectSampleSeller.create({
    data: {
      displayName,
      contactEmail,
      stripeAccountId: account.id,
    },
  })

  const status = await fetchLiveSellerStatus({
    stripeClient,
    stripeAccountId: saved.stripeAccountId,
  })

  return serializeSeller(saved, status)
}

function serializeSeller(
  seller: {
    id: string
    displayName: string
    contactEmail: string
    country: string
    stripeAccountId: string
    createdAt: Date
    updatedAt: Date
  },
  status: StripeConnectSampleSellerStatus
): StripeConnectSampleSellerRecord {
  return {
    id: seller.id,
    displayName: seller.displayName,
    contactEmail: seller.contactEmail,
    country: seller.country,
    stripeAccountId: seller.stripeAccountId,
    createdAt: seller.createdAt.toISOString(),
    updatedAt: seller.updatedAt.toISOString(),
    status,
  }
}

export async function listStripeConnectSampleSellers() {
  const sellers = await prisma.stripeConnectSampleSeller.findMany({
    orderBy: { createdAt: "desc" },
  })

  const stripeClient = getStripeSampleClient()

  return Promise.all(
    sellers.map(async seller => {
      const status = await fetchLiveSellerStatus({
        stripeClient,
        stripeAccountId: seller.stripeAccountId,
      })
      return serializeSeller(seller, status)
    })
  )
}

async function getRequiredSampleSeller(sellerId: string) {
  const seller = await prisma.stripeConnectSampleSeller.findUnique({
    where: { id: sellerId },
  })

  if (!seller) {
    throw new Error("Seller not found")
  }

  return seller
}

export async function createStripeConnectSampleOnboardingLink(input: {
  sellerId: string
  origin: string
}) {
  const seller = await getRequiredSampleSeller(input.sellerId)
  const stripeClient = getStripeSampleClient()

  // The sample uses Account Links against the V2 API so the connected account
  // owner can finish onboarding without us persisting onboarding state.
  const accountLink = await stripeClient.v2.core.accountLinks.create({
    account: seller.stripeAccountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${input.origin}/connect-demo?sellerId=${seller.id}&reauth=1`,
        return_url: `${input.origin}/connect-demo?sellerId=${seller.id}&onboarding=returned`,
      },
    },
  })

  return {
    url: accountLink.url,
    sellerId: seller.id,
    stripeAccountId: seller.stripeAccountId,
  }
}

export async function createStripeConnectSampleProduct(input: {
  sellerId: string
  name: string
  description?: string | null
  priceInCents: number
  currency?: string
}) {
  const seller = await getRequiredSampleSeller(input.sellerId)
  const name = input.name.trim()
  const description = input.description?.trim() || null
  const priceInCents = toPositiveInteger(input.priceInCents)
  const currency = toCurrency(input.currency)

  if (!name) {
    throw new Error("name is required")
  }

  const stripeClient = getStripeSampleClient()

  // Products are created on the platform account. We store the connected seller
  // mapping in metadata and in our own database so the storefront knows where
  // to send the destination charge when a customer buys the product.
  const product = await stripeClient.products.create({
    name,
    description: description ?? undefined,
    default_price_data: {
      unit_amount: priceInCents,
      currency,
    },
    metadata: {
      sample_seller_id: seller.id,
      sample_connected_account_id: seller.stripeAccountId,
    },
  })

  const stripePriceId =
    typeof product.default_price === "string"
      ? product.default_price
      : product.default_price?.id

  if (!stripePriceId) {
    throw new Error(
      "Stripe did not return a default price id for the sample product"
    )
  }

  const saved = await prisma.stripeConnectSampleProduct.create({
    data: {
      sellerId: seller.id,
      stripeProductId: product.id,
      stripePriceId,
      name,
      description,
      unitAmount: priceInCents,
      currency,
    },
    include: {
      seller: true,
    },
  })

  return serializeProduct(saved)
}

function serializeProduct(
  product: {
    id: string
    sellerId: string
    stripeProductId: string
    stripePriceId: string
    name: string
    description: string | null
    unitAmount: number
    currency: string
    createdAt: Date
    updatedAt: Date
    seller: {
      displayName: string
      stripeAccountId: string
    }
  }
): StripeConnectSampleProductRecord {
  return {
    id: product.id,
    sellerId: product.sellerId,
    sellerDisplayName: product.seller.displayName,
    sellerStripeAccountId: product.seller.stripeAccountId,
    stripeProductId: product.stripeProductId,
    stripePriceId: product.stripePriceId,
    name: product.name,
    description: product.description,
    unitAmount: product.unitAmount,
    currency: product.currency,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

export async function listStripeConnectSampleProducts() {
  const products = await prisma.stripeConnectSampleProduct.findMany({
    include: {
      seller: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return products.map(product => serializeProduct(product))
}

export async function createStripeConnectSampleCheckoutSession(input: {
  productId: string
  quantity: number
  origin: string
}) {
  const quantity = toPositiveInteger(input.quantity)
  const product = await prisma.stripeConnectSampleProduct.findUnique({
    where: { id: input.productId },
    include: { seller: true },
  })

  if (!product) {
    throw new Error("Product not found")
  }

  const stripeClient = getStripeSampleClient()
  const sellerStatus = await fetchLiveSellerStatus({
    stripeClient,
    stripeAccountId: product.seller.stripeAccountId,
  })

  if (!sellerStatus.readyToReceivePayments) {
    throw new Error(
      "This connected account is not ready to receive transfers yet. Complete onboarding first."
    )
  }

  const subtotal = product.unitAmount * quantity
  const applicationFeeAmount = Math.round(
    subtotal * (SAMPLE_APPLICATION_FEE_BPS / 10_000)
  )

  // The checkout session is created on the platform account. Stripe handles the
  // hosted payment page, while payment_intent_data routes the funds to the
  // connected account using a destination charge.
  const session = await stripeClient.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: product.currency,
          unit_amount: product.unitAmount,
          product: product.stripeProductId,
        },
        quantity,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: product.seller.stripeAccountId,
      },
      metadata: {
        sample_product_id: product.id,
        sample_seller_id: product.seller.id,
        sample_connected_account_id: product.seller.stripeAccountId,
      },
    },
    mode: "payment",
    success_url: `${input.origin}/connect-demo/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/connect-demo?checkout=cancelled`,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL")
  }

  return {
    id: session.id,
    url: session.url,
  }
}

export async function handleStripeConnectSampleWebhook(input: {
  payload: string
  signatureHeader: string | null
}) {
  if (!input.signatureHeader) {
    throw new Error("Missing stripe-signature header")
  }

  const stripeClient = getStripeSampleClient()

  // In stripe-node v20+, thin event parsing uses parseEventNotification().
  // Older docs may still refer to parseThinEvent(); the new method replaces it.
  const notification = stripeClient.parseEventNotification(
    input.payload,
    input.signatureHeader,
    requireStripeSampleWebhookSecret()
  )

  const parsed = notification as Stripe.Events.UnknownEventNotification
  const fullEvent = await parsed.fetchEvent()
  const relatedObject = await parsed.fetchRelatedObject()
  const relatedObjectSummary = parsed.related_object
    ? {
        id: parsed.related_object.id,
        type: parsed.related_object.type,
        fetched: relatedObject !== null,
      }
    : null

  switch (parsed.type) {
    case "v2.core.account[requirements].updated":
      return {
        received: true,
        type: parsed.type,
        message:
          "Account requirements changed. Refresh the onboarding status from the accounts API before allowing payouts.",
        eventId: fullEvent.id,
        relatedObject: relatedObjectSummary,
      }

    case "v2.core.account[configuration.recipient].capability_status_updated":
      return {
        received: true,
        type: parsed.type,
        message:
          "Recipient capability status changed. Refresh the connected account status before creating destination charges.",
        eventId: fullEvent.id,
        relatedObject: relatedObjectSummary,
      }

    default:
      return {
        received: true,
        type: parsed.type,
        message:
          "Thin event received. No sample-side state is persisted because onboarding status is always read live from Stripe.",
        eventId: fullEvent.id,
        relatedObject: relatedObjectSummary,
      }
  }
}
