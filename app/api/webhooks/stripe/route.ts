import { badRequest, ok } from "@/lib/http"
import { finalizeCustomerCheckout } from "@/lib/customerCheckout"
import {
  appendPaymentLedgerEvent,
  extractRecoveredExternalCheckout,
  extractStripeBillingState,
  verifyAndParseStripeWebhook,
} from "@/lib/payments"
import {
  findRestaurantSlugByStripeAccountId,
  findRestaurantSlugByStripeCustomerId,
  getRestaurantBySlug,
  updateRestaurantStripeConnection,
  updateRestaurantSubscriptionState,
} from "@/lib/restaurants"
import {
  findOrderStripeByCheckoutSessionId,
  markStripeWebhookEventAsProcessed,
  persistOrderStripeIds,
} from "@/lib/stripeBillingStore"
import {
  extractPaymentIntentIdFromCheckoutSession,
  extractStripeAccountIdFromEventObject,
  fetchStripeCharge,
  fetchStripeCheckoutSession,
  fetchStripeInvoice,
  fetchStripePaymentIntent,
  fetchStripeSubscription,
  fetchStripeV2CoreAccount,
  parseConnectedAccountStatusFromV2Account,
  parseStripeWebhookEnvelope,
  readStripeMetadata,
} from "@/lib/stripeConnectBilling"
import { withRestaurantContext } from "@/lib/tenantContext"
import { updateOrderStripePaymentState } from "@/lib/runtimeStore"

export const dynamic = "force-dynamic"

const HANDLED_EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
])

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

async function hydrateBillingObject(input: {
  eventType: string
  object: unknown
  objectId: string | null
}) {
  const objectRecord = asRecord(input.object)
  if (objectRecord) {
    const hasStatus = typeof objectRecord.status === "string"
    const hasSubscription =
      typeof objectRecord.subscription === "string" ||
      typeof objectRecord.id === "string"
    if (hasStatus && hasSubscription) {
      return objectRecord
    }
  }

  if (!input.objectId) {
    return objectRecord
  }

  if (
    input.eventType === "invoice.paid" ||
    input.eventType === "invoice.payment_succeeded" ||
    input.eventType === "invoice.payment_failed"
  ) {
    return fetchStripeInvoice(input.objectId)
  }

  if (
    input.eventType === "customer.subscription.updated" ||
    input.eventType === "customer.subscription.deleted"
  ) {
    return fetchStripeSubscription(input.objectId)
  }

  return objectRecord
}

export async function POST(req: Request) {
  try {
    const payload = await req.text()
    verifyAndParseStripeWebhook({
      payload,
      signatureHeader: req.headers.get("stripe-signature"),
    })
    const envelope = parseStripeWebhookEnvelope(payload)

    if (!envelope.id || !envelope.type) {
      return badRequest("Invalid Stripe webhook envelope", 400, {
        code: "STRIPE_WEBHOOK_INVALID_ENVELOPE",
        req,
      })
    }

    const isFirstDelivery = await markStripeWebhookEventAsProcessed({
      eventId: envelope.id,
      eventType: envelope.type,
    })

    if (!isFirstDelivery) {
      return ok(
        { received: true, duplicate: true },
        undefined,
        req
      )
    }

    if (!HANDLED_EVENT_TYPES.has(envelope.type)) {
      return ok({ received: true }, undefined, req)
    }

    if (
      envelope.type ===
        "v2.core.account[configuration.merchant].capability_status_updated" ||
      envelope.type ===
        "v2.core.account[configuration.recipient].capability_status_updated"
    ) {
      const accountId =
        extractStripeAccountIdFromEventObject(envelope.object) ??
        envelope.account

      if (!accountId) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "account_id_missing",
          },
          undefined,
          req
        )
      }

      const restaurantSlug =
        await findRestaurantSlugByStripeAccountId(accountId)
      if (!restaurantSlug) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "restaurant_for_account_not_found",
          },
          undefined,
          req
        )
      }

      const account = await fetchStripeV2CoreAccount(accountId)
      const accountStatus =
        parseConnectedAccountStatusFromV2Account(account)

      await updateRestaurantStripeConnection({
        slug: restaurantSlug,
        stripeAccountId: accountId,
        stripeAccountStatus: accountStatus.status,
        stripeChargesEnabled: accountStatus.chargesEnabled,
        stripePayoutsEnabled: accountStatus.payoutsEnabled,
        stripeDetailsSubmitted: accountStatus.detailsSubmitted,
      })

      return ok({ received: true }, undefined, req)
    }

    if (envelope.type === "checkout.session.completed") {
      const checkoutSessionId = envelope.objectId
      if (!checkoutSessionId) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "checkout_session_id_missing",
          },
          undefined,
          req
        )
      }

      const persisted =
        await findOrderStripeByCheckoutSessionId(checkoutSessionId)

      let session = asRecord(envelope.object)
      const hasInlineMetadata =
        session &&
        session.metadata &&
        typeof session.metadata === "object"
      if (!session || !hasInlineMetadata) {
        session = await fetchStripeCheckoutSession({
          checkoutSessionId,
          stripeAccountId: persisted?.stripeAccountId ?? envelope.account,
        })
      }

      if (!session) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "checkout_session_unreadable",
          },
          undefined,
          req
        )
      }

      const metadata = readStripeMetadata(session)
      const orderId = metadata.orderId ?? persisted?.orderId ?? null
      const restaurantSlug =
        metadata.restaurantSlug ?? persisted?.restaurantSlug ?? null
      const stripeAccountId =
        persisted?.stripeAccountId ?? envelope.account ?? null
      const paymentIntentId =
        extractPaymentIntentIdFromCheckoutSession(session)

      if (!orderId || !restaurantSlug || !stripeAccountId) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "checkout_session_mapping_missing",
          },
          undefined,
          req
        )
      }

      try {
        updateOrderStripePaymentState({
          orderId,
          checkoutSessionId,
          paymentIntentId,
          checkoutStatus: "PAID",
        })
      } catch {
        // Runtime state can be cold-started. Persisted Stripe refs remain the source of truth.
      }

      await persistOrderStripeIds({
        orderId,
        restaurantSlug,
        stripeAccountId,
        checkoutSessionId,
        paymentIntentId,
        checkoutStatus: "PAID",
      })

      return ok({ received: true }, undefined, req)
    }

    if (
      envelope.type === "invoice.paid" ||
      envelope.type === "invoice.payment_succeeded" ||
      envelope.type === "invoice.payment_failed" ||
      envelope.type === "customer.subscription.updated" ||
      envelope.type === "customer.subscription.deleted"
    ) {
      const billingObject = await hydrateBillingObject({
        eventType: envelope.type,
        object: envelope.object,
        objectId: envelope.objectId,
      })
      if (!billingObject) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "billing_object_unreadable",
          },
          undefined,
          req
        )
      }

      const billingState = extractStripeBillingState({
        object: billingObject,
      })

      const restaurantSlug =
        billingState.restaurantSlug ??
        (billingState.stripeAccountId
          ? await findRestaurantSlugByStripeAccountId(
              billingState.stripeAccountId
            )
          : null) ??
        (billingState.stripeCustomerId
          ? await findRestaurantSlugByStripeCustomerId(
              billingState.stripeCustomerId
            )
          : null)

      if (!restaurantSlug) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "billing_metadata_missing",
          },
          undefined,
          req
        )
      }

      const nextStatus =
        envelope.type === "invoice.paid" ||
        envelope.type === "invoice.payment_succeeded"
          ? "ACTIVE"
          : envelope.type === "invoice.payment_failed"
            ? "PAST_DUE"
            : envelope.type === "customer.subscription.deleted"
              ? "CANCELED"
              : billingState.subscriptionStatus

      await updateRestaurantSubscriptionState({
        slug: restaurantSlug,
        stripeCustomerId:
          billingState.stripeCustomerId ??
          billingState.stripeAccountId,
        stripeSubscriptionId: billingState.stripeSubscriptionId,
        subscriptionStatus: nextStatus,
      })

      return ok({ received: true }, undefined, req)
    }

    if (envelope.type === "charge.refunded") {
      const charge =
        asRecord(envelope.object) ??
        (envelope.objectId
          ? await fetchStripeCharge(envelope.objectId)
          : null)
      if (!charge) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "refund_object_unreadable",
          },
          undefined,
          req
        )
      }

      const metadata =
        charge.metadata && typeof charge.metadata === "object"
          ? (charge.metadata as Record<string, unknown>)
          : {}
      const restaurantSlug = String(
        metadata.restaurant_slug ?? ""
      ).trim()
      const tableNumber = Number(metadata.table_number ?? 0)
      if (!restaurantSlug || !Number.isFinite(tableNumber) || tableNumber <= 0) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "refund_metadata_missing",
          },
          undefined,
          req
        )
      }

      const amountMinorUnits = Number(charge.amount_refunded ?? 0)
      const originalAmountMinorUnits = Number(charge.amount ?? 0)
      const fullyRefunded =
        charge.refunded === true ||
        (Number.isFinite(amountMinorUnits) &&
          Number.isFinite(originalAmountMinorUnits) &&
          amountMinorUnits >= originalAmountMinorUnits)

      if (!Number.isFinite(amountMinorUnits) || amountMinorUnits <= 0) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "refund_amount_missing",
          },
          undefined,
          req
        )
      }

      if (!fullyRefunded) {
        return ok(
          {
            received: true,
            ignored: true,
            reason: "partial_refund_requires_manual_reconciliation",
          },
          undefined,
          req
        )
      }

      await appendPaymentLedgerEvent({
        restaurantSlug,
        tableNumber,
        eventType: "CHECKOUT_REFUND_CONFIRMED",
        amount: Number((amountMinorUnits / 100).toFixed(2)) * -1,
        currency: String(charge.currency ?? "GBP").toUpperCase(),
        provider: "STRIPE_CONNECT_STANDARD",
        providerRef: String(charge.id ?? "").trim() || null,
      })
      return ok({ received: true }, undefined, req)
    }

    const paymentIntentObject =
      asRecord(envelope.object) ??
      (envelope.objectId
        ? await fetchStripePaymentIntent(envelope.objectId)
        : null)
    if (!paymentIntentObject) {
      return ok(
        {
          received: true,
          ignored: true,
          reason: "payment_intent_unreadable",
        },
        undefined,
        req
      )
    }

    const recovered = extractRecoveredExternalCheckout(
      paymentIntentObject as Parameters<
        typeof extractRecoveredExternalCheckout
      >[0]
    )
    const restaurant = await getRestaurantBySlug(recovered.restaurantSlug)
    if (!restaurant) {
      return ok(
        {
          received: true,
          ignored: true,
          reason: "restaurant_not_found",
        },
        undefined,
        req
      )
    }

    if (envelope.type === "payment_intent.payment_failed") {
      await appendPaymentLedgerEvent({
        restaurantSlug: recovered.restaurantSlug,
        tableNumber: recovered.checkout.tableNumber,
        eventType: "CHECKOUT_PAYMENT_FAILED",
        amount: recovered.checkout.amount ?? 0,
        method: recovered.checkout.method,
        provider: recovered.providerResult.provider,
        providerRef: recovered.paymentIntentId,
        metadata: {
          status: recovered.status,
        },
      })
      return ok({ received: true }, undefined, req)
    }

    await withRestaurantContext(recovered.restaurantSlug, async () => {
      await finalizeCustomerCheckout({
        restaurantSlug: recovered.restaurantSlug,
        isDemo: restaurant.isDemo,
        checkout: recovered.checkout,
        preparedCheckout: recovered.preparedCheckout,
        providerResult: recovered.providerResult,
      })
    })

    return ok({ received: true }, undefined, req)
  } catch (error) {
    return badRequest((error as Error).message, 400, {
      code: "STRIPE_WEBHOOK_FAILED",
      req,
    })
  }
}
