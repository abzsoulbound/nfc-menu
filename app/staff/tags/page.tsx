"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { TagList } from "@/components/staff/TagList"

type Tag = {
  id: string
  active: boolean
  tableNumber: number | null
  activeSessionCount: number
  lastSeenAt: string
}

type Table = {
  id: string
  number: number
}

export default function StaffTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

  async function fetchTags() {
    const res = await fetch("/api/tags", { cache: "no-store" })
    const data = await res.json()
    setTags(data)
  }

  async function fetchTables() {
    const res = await fetch("/api/tables", { cache: "no-store" })
    const data = await res.json()
    setTables(data)
  }

  useEffect(() => {
    fetchTags()
    fetchTables()
    const interval = setInterval(() => {
      fetchTags()
      fetchTables()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  async function assignTag(tagId: string, tableNumber: number | null) {
    await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId,
        tableId:
          tableNumber === null
            ? null
            : tables.find(t => t.number === tableNumber)?.id,
      }),
    })

    setSelectedTag(null)
    fetchTags()
  }

  if (selectedTag) {
    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-center">
            <div className="font-mono text-sm">
              Tag {selectedTag.id}
            </div>
            <div className="flex gap-2">
              {!selectedTag.active && <Badge>inactive</Badge>}
              {selectedTag.activeSessionCount > 3 && (
                <Badge>many sessions</Badge>
              )}
            </div>
          </div>
        </Card>

        <Divider />

        <div className="space-y-2">
          {tables.map(table => (
            <Card
              key={table.id}
              className="cursor-pointer text-center"
              onClick={() =>
                assignTag(selectedTag.id, table.number)
              }
            >
              Assign to table {table.number}
            </Card>
          ))}

          <Card
            className="cursor-pointer text-center opacity-70"
            onClick={() => assignTag(selectedTag.id, null)}
          >
            Unassign tag
          </Card>
        </div>

        <Card
          className="cursor-pointer text-center opacity-70"
          onClick={() => setSelectedTag(null)}
        >
          Back to tags
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <TagList
        tags={tags}
        onSelect={setSelectedTag}
      />

      {tags.length === 0 && (
        <div className="opacity-60 text-center">
          No active NFC tags
        </div>
      )}
    </div>
  )
}
