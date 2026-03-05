import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

function canUseDatabase() {
  return !!process.env.DATABASE_URL
}

export type PersistOrderStripeIdsInput = {
  orderId: string
  restaurantSlug: string
  stripeAccountId: string
  checkoutSessionId?: string | null
  paymentIntentId?: string | null
  checkoutStatus?: string
}

export async function persistOrderStripeIds(
  input: PersistOrderStripeIdsInput
) {
  if (!canUseDatabase()) return

  await prisma.stripeOrderPayment.upsert({
    where: {
      orderId: input.orderId,
    },
    update: {
      checkoutSessionId:
        input.checkoutSessionId === undefined
          ? undefined
          : input.checkoutSessionId,
      paymentIntentId:
        input.paymentIntentId === undefined
          ? undefined
          : input.paymentIntentId,
      checkoutStatus:
        input.checkoutStatus === undefined
          ? undefined
          : input.checkoutStatus.toUpperCase(),
    },
    create: {
      orderId: input.orderId,
      restaurantSlug: input.restaurantSlug,
      stripeAccountId: input.stripeAccountId,
      checkoutSessionId: input.checkoutSessionId ?? null,
      paymentIntentId: input.paymentIntentId ?? null,
      checkoutStatus: (input.checkoutStatus ?? "CREATED").toUpperCase(),
    },
  })
}

export async function findOrderStripeByCheckoutSessionId(
  checkoutSessionId: string
) {
  if (!canUseDatabase()) return null
  const normalized = checkoutSessionId.trim()
  if (!normalized) return null
  return prisma.stripeOrderPayment.findFirst({
    where: {
      checkoutSessionId: normalized,
    },
    select: {
      orderId: true,
      restaurantSlug: true,
      stripeAccountId: true,
      checkoutSessionId: true,
      paymentIntentId: true,
      checkoutStatus: true,
    },
  })
}

export async function findOrderStripeByPaymentIntentId(
  paymentIntentId: string
) {
  if (!canUseDatabase()) return null
  const normalized = paymentIntentId.trim()
  if (!normalized) return null
  return prisma.stripeOrderPayment.findFirst({
    where: {
      paymentIntentId: normalized,
    },
    select: {
      orderId: true,
      restaurantSlug: true,
      stripeAccountId: true,
      checkoutSessionId: true,
      paymentIntentId: true,
      checkoutStatus: true,
    },
  })
}

export async function markStripeWebhookEventAsProcessed(input: {
  eventId: string
  eventType: string
}) {
  if (!canUseDatabase()) {
    return true
  }

  const eventId = input.eventId.trim()
  if (!eventId) {
    throw new Error("Stripe webhook event id is required")
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId,
        eventType: input.eventType.trim() || "unknown",
      },
    })
    return true
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false
    }
    throw error
  }
}
