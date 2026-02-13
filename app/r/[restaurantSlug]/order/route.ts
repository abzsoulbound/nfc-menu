import { POST as createOrder } from "@/app/api/orders/route"

export async function POST(
  req: Request,
  { params }: { params: { restaurantSlug: string } }
) {
  const url = new URL(req.url)
  url.searchParams.set("restaurantSlug", params.restaurantSlug)

  const headers = new Headers(req.headers)
  headers.set("x-restaurant-slug", params.restaurantSlug)

  const body = await req.text()
  const tenantReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
  })

  return createOrder(tenantReq)
}
