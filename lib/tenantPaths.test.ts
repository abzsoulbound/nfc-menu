import { describe, expect, it } from "vitest"
import {
  getTenantPrefixFromPath,
  tenantTagPath,
} from "@/lib/tenantPaths"

describe("tenantPaths", () => {
  it("extracts tenant prefix from a tenant path", () => {
    expect(getTenantPrefixFromPath("/r/marlos/menu")).toBe("/r/marlos")
    expect(getTenantPrefixFromPath("/menu")).toBe("")
  })

  it("builds a tenant-aware tag path with suffix", () => {
    expect(tenantTagPath("/r/acme/staff", "NFC-001", "review")).toBe(
      "/r/acme/t/NFC-001/review"
    )
  })

  it("falls back to a non-tenant tag path", () => {
    expect(tenantTagPath("/menu", "A-1")).toBe("/t/A-1")
  })
})
