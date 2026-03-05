import { describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/demo/simulator/route"
import { getDefaultRestaurantSlug } from "@/lib/tenant"

function demoRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("x-restaurant-slug", getDefaultRestaurantSlug())
  return new Request(url, {
    ...init,
    headers,
  })
}

describe("demo simulator api", () => {
  it("supports autostart plus burst ticks", async () => {
    const res = await GET(
      demoRequest(
        "http://localhost:3000/api/demo/simulator?autostart=1&burstTicks=3"
      )
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      ticks: number
      status: {
        enabled: boolean
      }
    }
    expect(payload.status.enabled).toBe(true)
    expect(payload.ticks).toBe(3)
  })

  it("supports burst action payloads", async () => {
    const res = await POST(
      demoRequest("http://localhost:3000/api/demo/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "BURST",
          burstTicks: 2,
        }),
      })
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      ticks: number
      status: {
        enabled: boolean
      }
    }
    expect(payload.status.enabled).toBe(true)
    expect(payload.ticks).toBe(2)
  })

  it("supports reset action", async () => {
    const res = await POST(
      demoRequest("http://localhost:3000/api/demo/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "RESET",
        }),
      })
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      ticks: number
      status: {
        enabled: boolean
      }
    }
    expect(payload.status.enabled).toBe(false)
    expect(payload.ticks).toBe(0)
  })

  it("rejects invalid actions", async () => {
    const res = await POST(
      demoRequest("http://localhost:3000/api/demo/simulator", {
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
})
