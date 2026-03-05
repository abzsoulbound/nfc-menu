import { POST as handleStripeWebhook } from "@/app/api/webhooks/stripe/route"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  return handleStripeWebhook(req)
}
