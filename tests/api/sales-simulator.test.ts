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
          simulatedMinuteOfDay: number
          simulatedTimeLabel: string
          dayStartMinute: number
          dayEndMinute: number
          stepMinutes: number
          autoMode: boolean
          isRushHour: boolean
          dayComplete: boolean
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
    expect(typeof payload.snapshot.status.simulatedMinuteOfDay).toBe("number")
    expect(typeof payload.snapshot.status.simulatedTimeLabel).toBe("string")
    expect(typeof payload.snapshot.status.dayStartMinute).toBe("number")
    expect(typeof payload.snapshot.status.dayEndMinute).toBe("number")
    expect(typeof payload.snapshot.status.stepMinutes).toBe("number")
    expect(typeof payload.snapshot.status.autoMode).toBe("boolean")
    expect(typeof payload.snapshot.status.isRushHour).toBe("boolean")
    expect(typeof payload.snapshot.status.dayComplete).toBe("boolean")
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

  it("supports minute-step progression and rush-hour flagging", async () => {
    const resetRes = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "RESET_DAY",
        }),
      })
    )
    expect(resetRes.status).toBe(200)

    const firstStepRes = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "STEP",
          stepMinutes: 60,
        }),
      })
    )
    expect(firstStepRes.status).toBe(200)

    const stepRes = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "STEP",
          stepMinutes: 60,
        }),
      })
    )
    expect(stepRes.status).toBe(200)

    const payload = (await stepRes.json()) as {
      snapshot: {
        status: {
          simulatedTimeLabel: string
          isRushHour: boolean
        }
      }
      ticks: number
    }
    expect(payload.snapshot.status.simulatedTimeLabel).toBe("11:00")
    expect(payload.snapshot.status.isRushHour).toBe(true)
    expect(payload.ticks).toBe(1)
  })

  it("supports auto mode toggling", async () => {
    const enableRes = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "SET_AUTO_MODE",
          autoMode: true,
        }),
      })
    )
    expect(enableRes.status).toBe(200)

    const enabledPayload = (await enableRes.json()) as {
      snapshot: {
        status: {
          enabled: boolean
          autoMode: boolean
        }
      }
    }
    expect(enabledPayload.snapshot.status.enabled).toBe(true)
    expect(enabledPayload.snapshot.status.autoMode).toBe(true)

    const disableRes = await POST(
      demoRequest("http://localhost:3000/api/sales/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "SET_AUTO_MODE",
          autoMode: false,
        }),
      })
    )
    expect(disableRes.status).toBe(200)

    const disabledPayload = (await disableRes.json()) as {
      snapshot: {
        status: {
          autoMode: boolean
        }
      }
    }
    expect(disabledPayload.snapshot.status.autoMode).toBe(false)
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

  it("allows other demo tenants, not just the sales-demo slug", async () => {
    const res = await GET(
      demoRequest(
        "http://localhost:3000/api/sales/simulator",
        undefined,
        { slug: "demo-template" }
      )
    )
    expect(res.status).toBe(200)
  })
})
