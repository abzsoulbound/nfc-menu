import { describe, expect, it } from "vitest"
import {
  formatTableNumber,
  parseTableNumbers,
  parseTableReferenceInput,
} from "@/lib/tableCatalog"

describe("tableCatalog", () => {
  it("expands comma and range table inputs", () => {
    expect(parseTableNumbers("1-3, 5, 3, 8-7")).toEqual([1, 2, 3, 5, 7, 8])
  })

  it("parses a fixed table reference", () => {
    expect(parseTableReferenceInput("12")).toEqual({
      tableNo: 12,
      displayLabel: "12",
      encoded: false,
    })
  })

  it("parses and formats an encoded temporary table reference", () => {
    const parsed = parseTableReferenceInput("5A")
    expect(parsed.tableNo).toBe(105001)
    expect(parsed.displayLabel).toBe("5A")
    expect(parsed.encoded).toBe(true)
    expect(formatTableNumber(parsed.tableNo ?? 0)).toBe("5A")
  })

  it("rejects invalid temporary table references", () => {
    expect(parseTableReferenceInput("0A").tableNo).toBeNull()
    expect(parseTableReferenceInput("ABC").tableNo).toBeNull()
    expect(parseTableReferenceInput("12!").tableNo).toBeNull()
  })
})
