import { badRequest, ok, readJson } from "@/lib/http"
import {
  getCustomerCheckoutQuoteByTableNumber,
  processCustomerCheckout,
} from "@/lib/runtimeStore"
import {
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
} from "@/lib/runtimePersistence"
import { publishRuntimeEvent } from "@/lib/realtime"
import { WalletMethod } from "@/lib/types"

export const dynamic = "force-dynamic"

type CheckoutBody = {
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
}

function parseMethod(method: string | undefined): WalletMethod {
  if (method === "APPLE_PAY") return "APPLE_PAY"
  if (method === "GOOGLE_PAY") return "GOOGLE_PAY"
  return "CARD"
}

export async function GET(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const url = new URL(req.url)
    const tableNumber = Number(url.searchParams.get("tableNumber"))
    if (!Number.isFinite(tableNumber)) {
      return badRequest("tableNumber is required")
    }
    return ok(getCustomerCheckoutQuoteByTableNumber(tableNumber))
  } catch (error) {
    return badRequest((error as Error).message)
  }
}

export async function POST(req: Request) {
  try {
    await hydrateRuntimeStateFromDb()
    const body = await readJson<CheckoutBody>(req)
    if (!Number.isFinite(body.tableNumber)) {
      return badRequest("tableNumber is required")
    }

    const result = processCustomerCheckout({
      tableNumber: body.tableNumber as number,
      shareCount: body.shareCount,
      amount: body.amount,
      tipPercent: body.tipPercent,
      method: parseMethod(body.method),
      email: body.email,
      promoCode: body.promoCode,
      customerId: body.customerId,
      customerName: body.customerName,
      phone: body.phone,
      marketingOptIn: body.marketingOptIn,
      redeemPoints: body.redeemPoints,
    })

    await persistRuntimeStateToDb()
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

    return ok(result)
  } catch (error) {
    const message = (error as Error).message
    return badRequest(message, message.startsWith("Unauthorized") ? 401 : 400)
  }
}
