import { GET as handleConnectCallback } from "@/app/api/payments/stripe/callback/route"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return handleConnectCallback(req)
}
