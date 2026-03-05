// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/stream/route"
import {
  createOrResumeSession,
  resetRuntimeStateForTests,
} from "@/lib/runtimeStore"

describe("stream route auth", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    process.env.WAITER_PASSCODES = "1111"
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "test"
  })

  it("allows open stream access in demo tenant", async () => {
    const res = await GET(new Request("http://localhost/api/stream"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/event-stream")
    await res.body?.cancel()
  })

  it("allows customer stream for known session id", async () => {
    const session = createOrResumeSession({
      origin: "CUSTOMER",
    })
    const res = await GET(
      new Request(
        `http://localhost/api/stream?sessionId=${encodeURIComponent(session.id)}`
      )
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/event-stream")
    await res.body?.cancel()
  })
})
