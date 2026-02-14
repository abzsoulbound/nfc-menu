import { describe, expect, it } from "vitest"
import {
  getTenantPrefixFromPath,
  tenantTagPath,
} from "@/lib/tenantPaths"

describe("tenantPaths", () => {
  it("extracts tenant prefix from a tenant path", () => {
    expect(getTenantPrefixFromPath("/order/r/marlos/menu")).toBe("/order")
    expect(getTenantPrefixFromPath("/order/menu")).toBe("/order")
    expect(getTenantPrefixFromPath("/menu")).toBe("/order")
  })

  it("builds a tenant-aware tag path with suffix", () => {
    expect(
      tenantTagPath("/order/r/acme/staff", "NFC-001", "review")
    ).toBe("/order/t/NFC-001/review")
  })

  it("builds a default-tenant tag path", () => {
    expect(tenantTagPath("/order/menu", "A-1")).toBe(
      "/order/t/A-1"
    )
  })
})
