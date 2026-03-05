import { beforeEach, describe, expect, it } from "vitest"
import { POST as loginPost } from "@/app/api/auth/staff/route"

describe("staff auth cookie security flags", () => {
  beforeEach(() => {
    process.env.WAITER_PASSCODES = "1111"
    process.env.BAR_PASSCODES = "2222"
    process.env.KITCHEN_PASSCODES = "3333"
    process.env.MANAGER_PASSCODES = "4444"
    process.env.ADMIN_PASSCODES = "9999"
    process.env.STAFF_AUTH_SECRET = "changeme"
    process.env.STAFF_SESSION_SECRET = "test-session-secret"
    process.env.SYSTEM_AUTH_SECRET = "test-system-secret"
  })

  it("does not force Secure cookie for plain HTTP local access", async () => {
    const mutableEnv = process.env as Record<
      string,
      string | undefined
    >
    const prevNodeEnv = mutableEnv.NODE_ENV
    mutableEnv.NODE_ENV = "production"

    try {
      const req = new Request("http://localhost:3000/api/auth/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode: "1111" }),
      })

      const res = await loginPost(req)
      expect(res.status).toBe(200)

      const cookie = res.headers.get("set-cookie") ?? ""
      expect(cookie).toContain("staff_auth=")
      expect(cookie).not.toContain("staff_auth=1111")
      expect(cookie).not.toMatch(/;\s*Secure/i)
    } finally {
      if (prevNodeEnv === undefined) {
        delete mutableEnv.NODE_ENV
      } else {
        mutableEnv.NODE_ENV = prevNodeEnv
      }
    }
  })

  it("sets Secure cookie when request is HTTPS (or forwarded as HTTPS)", async () => {
    const mutableEnv = process.env as Record<
      string,
      string | undefined
    >
    const prevNodeEnv = mutableEnv.NODE_ENV
    mutableEnv.NODE_ENV = "production"

    try {
      const req = new Request("http://localhost:3000/api/auth/staff", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ passcode: "1111" }),
      })

      const res = await loginPost(req)
      expect(res.status).toBe(200)

      const cookie = res.headers.get("set-cookie") ?? ""
      expect(cookie).toContain("staff_auth=")
      expect(cookie).not.toContain("staff_auth=1111")
      expect(cookie).toMatch(/;\s*Secure/i)
    } finally {
      if (prevNodeEnv === undefined) {
        delete mutableEnv.NODE_ENV
      } else {
        mutableEnv.NODE_ENV = prevNodeEnv
      }
    }
  })

  it("fails closed in production when no signing secret is configured", async () => {
    const mutableEnv = process.env as Record<
      string,
      string | undefined
    >
    const prevNodeEnv = mutableEnv.NODE_ENV
    const prevStaffSessionSecret = mutableEnv.STAFF_SESSION_SECRET
    const prevSystemSecret = mutableEnv.SYSTEM_AUTH_SECRET
    mutableEnv.NODE_ENV = "production"
    mutableEnv.STAFF_SESSION_SECRET = "changeme"
    mutableEnv.SYSTEM_AUTH_SECRET = "changeme"

    try {
      const req = new Request("http://localhost:3000/api/auth/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode: "1111" }),
      })

      const res = await loginPost(req)
      expect(res.status).toBe(500)
    } finally {
      if (prevNodeEnv === undefined) {
        delete mutableEnv.NODE_ENV
      } else {
        mutableEnv.NODE_ENV = prevNodeEnv
      }
      if (prevStaffSessionSecret === undefined) {
        delete mutableEnv.STAFF_SESSION_SECRET
      } else {
        mutableEnv.STAFF_SESSION_SECRET = prevStaffSessionSecret
      }
      if (prevSystemSecret === undefined) {
        delete mutableEnv.SYSTEM_AUTH_SECRET
      } else {
        mutableEnv.SYSTEM_AUTH_SECRET = prevSystemSecret
      }
    }
  })
})
