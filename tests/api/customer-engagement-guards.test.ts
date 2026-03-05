// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"
import {
  GET as engagementGet,
  POST as engagementPost,
} from "@/app/api/customer/engagement/route"
import {
  createOrResumeSession,
  resetRuntimeStateForTests,
} from "@/lib/runtimeStore"

describe("customer engagement access guards", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    process.env.WAITER_PASSCODES = "1111"
    process.env.MANAGER_PASSCODES = "4444"
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "test"
  })

  it("allows session notifications lookup without strict session header in demo tenant", async () => {
    const session = createOrResumeSession({
      origin: "CUSTOMER",
    })
    const url = `http://localhost/api/customer/engagement?view=notifications&recipient=${encodeURIComponent(
      `session:${session.id}`
    )}`

    const response = await engagementGet(new Request(url))
    expect(response.status).toBe(200)

    const withHeader = await engagementGet(
      new Request(url, {
        headers: {
          "x-session-id": session.id,
        },
      })
    )
    expect(withHeader.status).toBe(200)
  })

  it("allows loyalty lookup without strict customer header in demo tenant", async () => {
    const createRes = await engagementPost(
      new Request("http://localhost/api/customer/engagement", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "UPSERT_ACCOUNT",
          name: "A Customer",
          email: "customer@example.com",
        }),
      })
    )
    expect(createRes.status).toBe(200)
    const created = (await createRes.json()) as { id: string }

    const url = `http://localhost/api/customer/engagement?view=loyalty&customerId=${encodeURIComponent(created.id)}`

    const response = await engagementGet(new Request(url))
    expect(response.status).toBe(200)

    const withHeader = await engagementGet(
      new Request(url, {
        headers: {
          "x-customer-id": created.id,
        },
      })
    )
    expect(withHeader.status).toBe(200)
  })
})
