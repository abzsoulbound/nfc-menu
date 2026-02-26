"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TagList } from "@/components/staff/TagList"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import { TableDTO, TagDTO } from "@/lib/types"

export default function StaffTagsPage() {
  const [tags, setTags] = useState<TagDTO[]>([])
  const [tables, setTables] = useState<TableDTO[]>([])
  const [selectedTagId, setSelectedTagId] = useState<string | null>(
    null
  )

  const fetchTags = useCallback(async () => {
    const data = await fetchJson<TagDTO[]>("/api/tags", {
      cache: "no-store",
    })
    setTags(data)
  }, [])

  const fetchTables = useCallback(async () => {
    const data = await fetchJson<TableDTO[]>("/api/tables", {
      cache: "no-store",
    })
    setTables(data)
  }, [])

  useEffect(() => {
    fetchTags().catch(() => {})
    fetchTables().catch(() => {})
    const interval = setInterval(() => {
      fetchTags().catch(() => {})
      fetchTables().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchTags, fetchTables])

  useRealtimeSync(() => {
    fetchTags().catch(() => {})
    fetchTables().catch(() => {})
  })

  const selectedTag = useMemo(
    () => tags.find(tag => tag.id === selectedTagId) ?? null,
    [tags, selectedTagId]
  )

  async function assignTag(tagId: string, tableId: string | null) {
    await fetchJson("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId,
        tableId,
      }),
    })
    await fetchTags()
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Tags</h2>
          <TagList
            tags={tags}
            onSelect={tag => setSelectedTagId(tag.id)}
            selectedTagId={selectedTagId}
          />
        </Card>

        <Card className="space-y-3">
          {!selectedTag ? (
            <div className="py-10 text-center text-sm text-secondary">
              Select a tag to assign or unassign.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="mono-font text-lg font-semibold">
                    {selectedTag.id}
                  </div>
                  <div className="text-sm text-secondary">
                    Current table: {selectedTag.tableNumber ?? "Unassigned"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selectedTag.active && (
                    <Badge variant="warning">Inactive</Badge>
                  )}
                  <Badge variant="neutral">
                    {selectedTag.activeSessionCount} session(s)
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {tables.map(table => (
                  <Button
                    key={table.id}
                    variant={
                      selectedTag.tableNumber === table.number
                        ? "primary"
                        : "quiet"
                    }
                    className="min-h-[52px]"
                    onClick={() =>
                      assignTag(selectedTag.id, table.id).catch(
                        () => {}
                      )
                    }
                  >
                    Assign to table {table.number}
                  </Button>
                ))}
              </div>

              <Button
                variant="danger"
                className="w-full min-h-[52px]"
                onClick={() =>
                  assignTag(selectedTag.id, null).catch(() => {})
                }
              >
                Unassign tag
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
