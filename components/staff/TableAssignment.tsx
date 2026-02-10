"use client"

import { Card } from "@/components/ui/Card"

export function TableAssignment({
  tableId,
  tableNumber,
  tags,
  allTags,
  onChange,
}: {
  tableId: string
  tableNumber: number
  tags: { id: string }[]
  allTags: { id: string; tableNumber: number | null }[]
  onChange: () => void
}) {
  async function assign(tagId: string | null) {
    await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId,
        tableId,
      }),
    })
    onChange()
  }

  return (
    <Card>
      <div className="space-y-2">
        <div className="text-sm opacity-70">
          Assigned tags
        </div>

        {tags.map(t => (
          <div key={t.id}>{t.id}</div>
        ))}

        <div className="text-sm opacity-70 mt-2">
          Assign new
        </div>

        {allTags
          .filter(t => t.tableNumber === null)
          .map(t => (
            <div
              key={t.id}
              className="cursor-pointer"
              onClick={() => assign(t.id)}
            >
              {t.id}
            </div>
          ))}
      </div>
    </Card>
  )
}