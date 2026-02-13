import { describe, expect, it, vi } from "vitest"
import { ensureTagByToken, findTagByToken } from "@/lib/db/tags"

type TagRecord = {
  id: string
  restaurantId: string
  tagId: string
}

describe("tag tenant safety", () => {
  it("allows the same tagId across tenants and scopes lookups by restaurantId", async () => {
    const records: TagRecord[] = []

    const fakeClient = {
      nfcTag: {
        findUnique: vi.fn(async ({ where }: any) => {
          const key = where?.restaurantId_tagId
          return (
            records.find(
              record =>
                record.restaurantId === key?.restaurantId &&
                record.tagId === key?.tagId
            ) ?? null
          )
        }),
        create: vi.fn(async ({ data }: any) => {
          const record: TagRecord = {
            id: data.id ?? crypto.randomUUID(),
            restaurantId: data.restaurantId,
            tagId: data.tagId,
          }
          records.push(record)
          return record
        }),
      },
    }

    const tagA = await ensureTagByToken({
      restaurantId: "rest_a",
      tagId: "TAG-1",
      client: fakeClient,
    })
    const tagB = await ensureTagByToken({
      restaurantId: "rest_b",
      tagId: "TAG-1",
      client: fakeClient,
    })

    expect(records).toHaveLength(2)
    expect(tagA.id).not.toBe(tagB.id)

    const lookupA = await findTagByToken({
      restaurantId: "rest_a",
      tagId: "TAG-1",
      client: fakeClient,
    })
    const lookupB = await findTagByToken({
      restaurantId: "rest_b",
      tagId: "TAG-1",
      client: fakeClient,
    })

    expect(lookupA?.restaurantId).toBe("rest_a")
    expect(lookupB?.restaurantId).toBe("rest_b")
  })
})
