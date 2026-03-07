// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireRestaurantForSlugMock = vi.fn()
const resolveRestaurantRoleForCredentialsMock = vi.fn()
const resolveRestaurantRoleForPasscodeMock = vi.fn()

vi.mock("@/lib/restaurants", () => ({
  requireRestaurantForSlug: (...args: unknown[]) =>
    requireRestaurantForSlugMock(...args),
  resolveRestaurantRoleForCredentials: (...args: unknown[]) =>
    resolveRestaurantRoleForCredentialsMock(...args),
  resolveRestaurantRoleForPasscode: (...args: unknown[]) =>
    resolveRestaurantRoleForPasscodeMock(...args),
}))

import { POST as staffLoginPost } from "@/app/api/auth/staff/route"

function makeRequest(headers?: HeadersInit) {
  return new Request("http://localhost/api/auth/staff?restaurant=tenant-a", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      passcode: "0000",
    }),
  })
}

describe("staff login lockout hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRestaurantForSlugMock.mockResolvedValue({
      slug: "tenant-a",
      isDemo: false,
    })
    resolveRestaurantRoleForCredentialsMock.mockResolvedValue(null)
    resolveRestaurantRoleForPasscodeMock.mockResolvedValue(null)
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      "test"
  })

  it("locks login attempts even when attacker rotates client headers", async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await staffLoginPost(
        makeRequest({
          "user-agent": `ua-${attempt}`,
          "x-forwarded-for": `198.51.100.${attempt}`,
          "x-real-ip": `203.0.113.${attempt}`,
        })
      )
      expect(res.status).toBe(401)
    }

    const locked = await staffLoginPost(
      makeRequest({
        "user-agent": "ua-final",
        "x-forwarded-for": "198.51.100.250",
        "x-real-ip": "203.0.113.250",
      })
    )
    expect(locked.status).toBe(429)
    const payload = (await locked.json()) as Record<string, unknown>
    expect(payload.code).toBe("STAFF_LOGIN_LOCKED")
  })
})
