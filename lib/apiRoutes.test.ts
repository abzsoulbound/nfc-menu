import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashPasscode } from "@/lib/staffSessions"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    staffLoginAttempt: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    staffUser: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    staffSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    restaurant: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
  } as any,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

import { POST as staffLoginPost } from "@/app/api/staff/login/route"
import { POST as staffLogoutPost } from "@/app/api/staff/logout/route"
import { GET as ordersGet } from "@/app/api/orders/route"

function tenantHeaders(restaurantId = "rest_test") {
  return {
    "content-type": "application/json",
    "x-restaurant-id": restaurantId,
    "x-request-id": "req_test_1",
  }
}

describe("api route safety", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.staffLoginAttempt.findMany.mockResolvedValue([])
    prismaMock.staffLoginAttempt.create.mockResolvedValue({ id: "attempt_1" })
    prismaMock.staffSession.create.mockResolvedValue({ id: "staff_session_1" })
    prismaMock.staffSession.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.staffUser.update.mockResolvedValue({ id: "staff_1" })

    prismaMock.restaurant.findUnique.mockResolvedValue({
      id: "rest_test",
      slug: "test",
      name: "Test",
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      domain: null,
      vatRate: 0.2,
      serviceCharge: 0,
    })
    prismaMock.session.findUnique.mockResolvedValue(null)
    prismaMock.session.findFirst.mockResolvedValue(null)
    prismaMock.order.findMany.mockResolvedValue([])
  })

  it("fails loudly when tenant headers are missing", async () => {
    const req = new Request("http://localhost/api/staff/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "admin", passcode: "1234" }),
    })

    const res = await staffLoginPost(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("TENANT_CONTEXT_MISSING")
    expect(res.headers.get("x-request-id")).toBeTruthy()
  })

  it("creates and revokes a secure HttpOnly staff session cookie", async () => {
    const passcodeHash = await hashPasscode("1234")
    prismaMock.staffUser.findFirst.mockResolvedValue({
      id: "staff_1",
      name: "Test Admin",
      role: "admin",
      passcodeHash,
    })

    const loginReq = new Request("http://localhost/api/staff/login", {
      method: "POST",
      headers: tenantHeaders(),
      body: JSON.stringify({ role: "admin", passcode: "1234" }),
    })

    const loginRes = await staffLoginPost(loginReq)
    const loginCookie = loginRes.headers.get("set-cookie") ?? ""

    expect(loginRes.status).toBe(200)
    expect(loginCookie).toContain("staff_session=")
    expect(loginCookie.toLowerCase()).toContain("httponly")

    const tokenMatch = loginCookie.match(/staff_session=([^;]+)/)
    expect(tokenMatch).toBeTruthy()

    const logoutReq = new Request("http://localhost/api/staff/logout", {
      method: "POST",
      headers: {
        ...tenantHeaders(),
        cookie: `staff_session=${tokenMatch?.[1] ?? ""}`,
      },
    })

    const logoutRes = await staffLogoutPost(logoutReq)
    const logoutCookie = logoutRes.headers.get("set-cookie") ?? ""

    expect(logoutRes.status).toBe(200)
    expect(prismaMock.staffSession.updateMany).toHaveBeenCalledTimes(1)
    expect(logoutCookie).toContain("staff_session=")
    expect(logoutCookie.toLowerCase()).toContain("httponly")
  })

  it("prevents cross-tenant session reads", async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: "session_other_restaurant",
      restaurantId: "rest_other",
      tagId: "TAG-1",
      tableId: null,
      status: "ACTIVE",
      lastActivityAt: new Date(),
    })

    const req = new Request(
      "http://localhost/api/orders?sessionId=session_other_restaurant",
      {
        method: "GET",
        headers: tenantHeaders("rest_test", "test"),
      }
    )

    const res = await ordersGet(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ items: [] })
  })
})
