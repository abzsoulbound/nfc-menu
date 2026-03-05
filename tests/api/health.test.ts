// @vitest-environment node
import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/health/route"

describe("health route", () => {
  it("returns liveness payload", async () => {
    const req = new Request("http://localhost:3000/api/health")
    const res = await GET(req)
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      status: string
      service: string
      timestamp: string
    }

    expect(payload.status).toBe("ok")
    expect(payload.service).toBe("nfc-pos")
    expect(typeof payload.timestamp).toBe("string")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
