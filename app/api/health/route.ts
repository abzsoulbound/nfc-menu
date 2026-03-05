import { ok } from "@/lib/http"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return ok(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "nfc-pos",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
    req
  )
}
