// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const createRuntimeEventStreamMock = vi.fn(
  (_restaurantSlug: string) => new ReadableStream()
)

vi.mock("@/lib/realtime", () => ({
  createRuntimeEventStream: (restaurantSlug: string) =>
    createRuntimeEventStreamMock(restaurantSlug),
}))

vi.mock("@/lib/runtimePersistence", () => ({
  hydrateRuntimeStateFromDb: vi.fn(async () => undefined),
}))

vi.mock("@/lib/restaurantRequest", () => ({
  withRestaurantRequestContext: async (
    _req: Request,
    run: (context: {
      restaurantSlug: string
      restaurant: { slug: string; isDemo: boolean }
    }) => Promise<Response> | Response
  ) =>
    run({
      restaurantSlug: "tenant-prod",
      restaurant: {
        slug: "tenant-prod",
        isDemo: false,
      },
    }),
}))

import { GET } from "@/app/api/stream/route"

describe("stream route auth for non-demo tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WAITER_PASSCODES = "1111"
    process.env.STAFF_AUTH_SECRET = "changeme"
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      "test"
  })

  it("rejects unauthenticated callers", async () => {
    const res = await GET(new Request("http://localhost/api/stream"))
    expect(res.status).toBe(401)
  })

  it("allows staff callers", async () => {
    const res = await GET(
      new Request("http://localhost/api/stream", {
        headers: {
          "x-staff-auth": "1111",
        },
      })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/event-stream")
    expect(createRuntimeEventStreamMock).toHaveBeenCalledWith(
      "tenant-prod"
    )
    await res.body?.cancel()
  })
})
