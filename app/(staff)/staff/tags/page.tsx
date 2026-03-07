"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { TagList } from "@/components/staff/TagList"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { FormInput } from "@/components/ui/FormField"
import { fetchJson } from "@/lib/fetchJson"
import { useRealtimeSync } from "@/lib/useRealtimeSync"
import { TableDTO, TagDTO } from "@/lib/types"

export default function StaffTagsPage() {
  const [tags, setTags] = useState<TagDTO[]>([])
  const [tables, setTables] = useState<TableDTO[]>([])
  const [selectedTagId, setSelectedTagId] = useState<string | null>(
    null
  )
  const [search, setSearch] = useState("")

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
  const filteredTags = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tags

    return tags.filter(tag => {
      const haystack = [
        tag.id,
        String(tag.tableNumber ?? ""),
        String(tag.activeSessionCount),
        tag.active ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search, tags])
  const unassignedCount = tags.filter(
    tag => tag.tableNumber === null
  ).length

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
    <div className="relative px-4 py-5 md:px-6 md:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(96,138,214,0.22),rgba(96,138,214,0))] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-52 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,162,236,0.2),rgba(103,162,236,0))] blur-3xl"
      />

      <div className="mx-auto space-y-4">
        <Card
          variant="elevated"
          className="border-[rgba(111,147,213,0.4)] bg-[linear-gradient(132deg,rgba(15,28,50,0.96),rgba(21,39,66,0.94),rgba(29,52,85,0.92))]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(184,205,244,0.82)]">
                NFC Tag Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#eef4ff] md:text-4xl">
                Assign and track table tags
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[rgba(197,214,244,0.86)]">
                Keep assignments clean so table routing and order sessions stay
                reliable during service.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-chip-neutral">
                  Tags: {tags.length}
                </span>
                <span className="status-chip status-chip-neutral">
                  Unassigned: {unassignedCount}
                </span>
              </div>
            </div>

            <Button
              variant="quiet"
              className="min-h-[44px]"
              onClick={() => {
                fetchTags().catch(() => {})
                fetchTables().catch(() => {})
              }}
            >
              Refresh
            </Button>
          </div>
        </Card>

        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1fr_1.25fr]">
          <Card className="space-y-3 border-[rgba(114,153,225,0.34)]">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Tags</h2>
              <FormInput
                label="Search tags"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="id, table, active, sessions"
              />
            </div>
            <TagList
              tags={filteredTags}
              onSelect={tag => setSelectedTagId(tag.id)}
              selectedTagId={selectedTagId}
            />
          </Card>

          <Card className="space-y-3 border-[rgba(114,153,225,0.34)]">
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
    </div>
  )
}
