import { beforeEach, describe, expect, it } from "vitest"
import {
  GET as getExperiments,
  POST as postExperiments,
} from "@/app/api/ux/experiments/route"
import { POST as postAssignment } from "@/app/api/ux/assignment/route"
import { POST as postEvent } from "@/app/api/ux/events/route"
import { GET as getInsights } from "@/app/api/ux/insights/route"

describe("ux experimentation api", () => {
  beforeEach(() => {
    process.env.WAITER_PASSCODES = "1111"
    process.env.KITCHEN_PASSCODES = "2222"
    process.env.BAR_PASSCODES = "3333"
    process.env.MANAGER_PASSCODES = "4444"
    process.env.ADMIN_PASSCODES = "9999"
    process.env.STAFF_AUTH_SECRET = "changeme"
  })

  it("enforces manager/admin auth for experiment management", async () => {
    const unauthorized = await getExperiments(
      new Request("http://localhost/api/ux/experiments")
    )
    expect(unauthorized.status).toBe(401)

    const authorized = await getExperiments(
      new Request("http://localhost/api/ux/experiments", {
        headers: {
          "x-staff-auth": "4444",
        },
      })
    )
    expect(authorized.status).toBe(200)
  })

  it("supports upsert, deterministic assignment, event ingest, and insights", async () => {
    const upsert = await postExperiments(
      new Request("http://localhost/api/ux/experiments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-staff-auth": "4444",
        },
        body: JSON.stringify({
          key: "customer_funnel_v1",
          name: "Customer Funnel",
          status: "LIVE",
          trafficPercent: 100,
          variants: [
            {
              key: "control",
              label: "Control",
              weight: 1,
            },
            {
              key: "strict",
              label: "Strict",
              weight: 1,
              uxPatch: {
                orderSafetyMode: "STRICT",
                checkoutSafetyMode: "STRICT",
              },
            },
          ],
        }),
      })
    )
    expect(upsert.status).toBe(200)

    const firstAssignmentRes = await postAssignment(
      new Request("http://localhost/api/ux/assignment", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-a",
          experimentKey: "customer_funnel_v1",
        }),
      })
    )
    expect(firstAssignmentRes.status).toBe(200)
    const firstAssignment = (await firstAssignmentRes.json()) as {
      assignment: {
        variantKey: string
      } | null
    }
    expect(firstAssignment.assignment?.variantKey).toBeTruthy()

    const secondAssignmentRes = await postAssignment(
      new Request("http://localhost/api/ux/assignment", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-a",
          experimentKey: "customer_funnel_v1",
        }),
      })
    )
    const secondAssignment = (await secondAssignmentRes.json()) as {
      assignment: {
        variantKey: string
      } | null
    }
    expect(secondAssignment.assignment?.variantKey).toBe(
      firstAssignment.assignment?.variantKey
    )

    const eventRes = await postEvent(
      new Request("http://localhost/api/ux/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-a",
          eventName: "page_view",
          page: "menu",
          step: "discover",
          experimentKey: "customer_funnel_v1",
        }),
      })
    )
    expect(eventRes.status).toBe(200)

    const insightsRes = await getInsights(
      new Request(
        "http://localhost/api/ux/insights?experimentKey=customer_funnel_v1&days=14",
        {
          headers: {
            "x-staff-auth": "4444",
          },
        }
      )
    )
    expect(insightsRes.status).toBe(200)
    const insights = (await insightsRes.json()) as {
      experimentKey: string
      totalEvents: number
      variants: Array<{ variantKey: string }>
    }
    expect(insights.experimentKey).toBe("customer_funnel_v1")
    expect(insights.totalEvents).toBeGreaterThan(0)
    expect(insights.variants.length).toBeGreaterThan(0)
  })
})