import { describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/sales/simulator/route"
import { getSalesDemoSlug } from "@/lib/tenant"

function demoRequest(
  url: string,
  init?: RequestInit,
  options?: { slug?: string }
) {
  const headers = new Headers(init?.headers)
  headers.set(
    "x-restaurant-slug",
    options?.slug ?? getSalesDemoSlug()
  )
  return new Request(url, {
    ...init,
    headers,
  })
}

describe("sales simulator api", () => {
  it("returns a structured snapshot payload", async () => {
    const res = await GET(
      demoRequest(
        "http://localhost:3000/api/sales/simulator?autostart=1&burstTicks=2"
      )
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      snapshot: {
        status: {
          queue: {
            kitchen: number
            bar: number
            ready: number
          }
        }
        shift: {
          orders: number
          totalRevenue: number
        }
        live: {
          activeSessions: number
          checkoutReceipts: number
        }
      }
      ticks: number
    }

    expect(typeof payload.snapshot.status.queue.kitchen).toBe("number")
    expect(typeof payload.snapshot.status.queue.bar).toBe("number")
    expect(typeof payload.snapshot.status.queue.ready).toBe("number")
    expect(typeof payload.snapshot.shift.orders).toBe("number")
    expect(typeof payload.snapshot.shift.totalRevenue).toBe("number")
    expect(typeof payload.snapshot.live.activeSessions).toBe("number")
    expect(typeof payload.snapshot.live.checkoutReceipts).toBe("number")
    expect(payload.ticks).toBe(2)
  })

  it("supports burst actions", async () => {
    const res = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "START_AND_BURST",
          burstTicks: 3,
        }),
      })
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      ticks: number
      snapshot: {
        status: {
          enabled: boolean
        }
      }
    }
    expect(payload.snapshot.status.enabled).toBe(true)
    expect(payload.ticks).toBe(3)
  })

  it("rejects unsupported actions", async () => {
    const res = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "INVALID",
        }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("rejects non-sales demo tenants", async () => {
    const res = await GET(
      demoRequest(
        "http://localhost:3000/api/sales/simulator",
        undefined,
        { slug: "demo-template" }
      )
    )
    expect(res.status).toBe(403)
  })
})
