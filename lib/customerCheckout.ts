import {
  appendPaymentLedgerEvent,
  assertPaymentsAllowedForTenant,
  getPaymentProviderAdapterForTenant,
  readIdempotencyKey,
  type PaymentChargeResult,
} from "@/lib/payments"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import {
  processPreparedCustomerCheckout,
  previewCustomerCheckout,
  readExistingCheckoutReplay,
  type PreparedCustomerCheckoutInput,
} from "@/lib/runtimeStore"
import { WalletMethod } from "@/lib/types"

export type CheckoutRequestBody = {
  tableNumber?: number
  shareCount?: number
  amount?: number
  tipPercent?: number
  method?: WalletMethod
  email?: string | null
  promoCode?: string | null
  customerId?: string | null
  customerName?: string | null
  phone?: string | null
  marketingOptIn?: boolean
  redeemPoints?: number
  idempotencyKey?: string
}

export type NormalizedCheckoutRequest = {
  tableNumber: number
  shareCount?: number
  amount?: number
  tipPercent?: number
  method: WalletMethod
  email?: string | null
  promoCode?: string | null
  customerId?: string | null
  customerName?: string | null
  phone?: string | null
  marketingOptIn?: boolean
  redeemPoints?: number
  idempotencyKey?: string
}

export function parseCheckoutMethod(
  method: string | undefined
): WalletMethod {
  if (method === "APPLE_PAY") return "APPLE_PAY"
  if (method === "GOOGLE_PAY") return "GOOGLE_PAY"
  return "CARD"
}

export function normalizeCheckoutRequest(input: {
  body: CheckoutRequestBody
  req?: Request
  isDemo: boolean
}) {
  const idempotencyKey = input.req
    ? readIdempotencyKey(input.req, input.body.idempotencyKey)
    : input.body.idempotencyKey?.trim() ?? ""

  if (idempotencyKey && idempotencyKey.length > 128) {
    throw new Error("idempotency key is too long")
  }

  if (!Number.isFinite(input.body.tableNumber)) {
    throw new Error("tableNumber is required")
  }

  if (
    process.env.NODE_ENV === "production" &&
    !input.isDemo &&
    !idempotencyKey
  ) {
    throw new Error("Idempotency-Key is required in production checkout")
  }

  return {
    tableNumber: input.body.tableNumber as number,
    shareCount: input.body.shareCount,
    amount: input.body.amount,
    tipPercent: input.body.tipPercent,
    method: parseCheckoutMethod(input.body.method),
    email: input.body.email,
    promoCode: input.body.promoCode,
    customerId: input.body.customerId,
    customerName: input.body.customerName,
    phone: input.body.phone,
    marketingOptIn: input.body.marketingOptIn,
    redeemPoints: input.body.redeemPoints,
    idempotencyKey: idempotencyKey || undefined,
  } satisfies NormalizedCheckoutRequest
}

export async function finalizeCustomerCheckout(input: {
  restaurantSlug: string
  isDemo: boolean
  checkout: NormalizedCheckoutRequest
  preparedCheckout?: PreparedCustomerCheckoutInput
  providerResult?: PaymentChargeResult
}) {
  assertPaymentsAllowedForTenant({
    isDemo: input.isDemo,
  })

  await hydrateRuntimeStateFromDb()

  try {
    const replay = readExistingCheckoutReplay(
      input.preparedCheckout?.idempotencyKey ??
        input.checkout.idempotencyKey
    )
    if (replay) {
      return {
        result: replay.response,
        providerResult: input.providerResult,
      }
    }

    const prepared =
      input.preparedCheckout ??
      previewCustomerCheckout({
        tableNumber: input.checkout.tableNumber,
        shareCount: input.checkout.shareCount,
        amount: input.checkout.amount,
        tipPercent: input.checkout.tipPercent,
        method: input.checkout.method,
        email: input.checkout.email,
        promoCode: input.checkout.promoCode,
        customerId: input.checkout.customerId,
        customerName: input.checkout.customerName,
        phone: input.checkout.phone,
        marketingOptIn: input.checkout.marketingOptIn,
        redeemPoints: input.checkout.redeemPoints,
        idempotencyKey: input.checkout.idempotencyKey,
      })

    let providerResult = input.providerResult
    if (!providerResult) {
      const chargeReference =
        prepared.idempotencyKey ??
        `${prepared.tableNumber}:${prepared.totalCharged.toFixed(2)}`
      providerResult = await getPaymentProviderAdapterForTenant({
        isDemo: input.isDemo,
      }).charge({
        amount: prepared.totalCharged,
        currency: "GBP",
        reference: chargeReference,
        idempotencyKey: chargeReference,
        metadata: {
          tableNumber: prepared.tableNumber,
          restaurantSlug: input.restaurantSlug,
        },
      })
    }

    const result = processPreparedCustomerCheckout(prepared)

    await persistRuntimeStateToDb()
    if (!result.idempotencyReplay) {
      publishRuntimeEvent("checkout.completed", {
        tableNumber: result.receipt.tableNumber,
        receiptId: result.receipt.receiptId,
      })
      publishRuntimeEvent("billing.updated", {
        tableId: result.bill.tableId,
      })
      publishRuntimeEvent("notifications.updated", {
        recipient: result.receipt.email,
      })
    }

    await appendPaymentLedgerEvent({
      restaurantSlug: input.restaurantSlug,
      tableNumber: result.receipt.tableNumber,
      receiptId: result.receipt.receiptId,
      eventType: result.idempotencyReplay
        ? "CHECKOUT_REPLAY"
        : "CHECKOUT_CHARGE",
      amount: result.receipt.totalCharged,
      method: result.receipt.method,
      provider: providerResult?.provider ?? null,
      providerRef: providerResult?.providerRef ?? null,
      metadata: {
        promoCode: result.receipt.promoCode,
        loyaltyRedeemedPoints: result.receipt.loyaltyRedeemedPoints,
        loyaltyEarnedPoints: result.receipt.loyaltyEarnedPoints,
        idempotencyReplay: result.idempotencyReplay,
      },
    })

    return {
      result,
      providerResult,
    }
  } catch (error) {
    try {
      await hydrateRuntimeStateFromDb({ force: true })
    } catch {
      // best-effort rollback to persisted state
    }
    throw error
  }
}
