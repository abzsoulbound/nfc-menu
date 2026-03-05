import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/setup/status/[token]/route"

describe("setup status route", () => {
  it("returns invalid for malformed token", async () => {
    const req = new Request("http://localhost:3000/api/setup/status/bad")
    const res = await GET(req, { params: { token: "bad" } })
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      valid: boolean
      state: string
    }

    expect(payload.valid).toBe(false)
    expect(payload.state).toBe("INVALID")
  })
})
