import { afterEach, describe, expect, it } from "vitest"
import { GET, POST } from "@/app/api/demo/simulator/route"

const mutableEnv = process.env as Record<string, string | undefined>

const previousNodeEnv = mutableEnv.NODE_ENV
const previousEnableDemoTools = mutableEnv.ENABLE_DEMO_TOOLS

afterEach(() => {
  mutableEnv.NODE_ENV = previousNodeEnv
  mutableEnv.ENABLE_DEMO_TOOLS = previousEnableDemoTools
})

describe("demo simulator api guard", () => {
  it("returns 404 when demo tools are disabled in production", async () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.ENABLE_DEMO_TOOLS = "false"

    const getRes = await GET(
      new Request("http://localhost/api/demo/simulator")
    )
    expect(getRes.status).toBe(404)

    const postRes = await POST(
      new Request("http://localhost/api/demo/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "TICK" }),
      })
    )
    expect(postRes.status).toBe(404)
  })
})
