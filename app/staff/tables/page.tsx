"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { TableAssignment } from "@/components/staff/TableAssignment"

type Table = {
  id: string
  number: number
  locked: boolean
  stale: boolean
  closed: boolean
  paid: boolean
  openedAt: string
  contributionWindowEndsAt: string
}

type Tag = {
  id: string
  tableNumber: number | null
}

export default function StaffTablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTable, setActiveTable] = useState<Table | null>(null)

  async function parseArrayResponse<T>(
    res: Response
  ): Promise<T[]> {
    const raw = await res.text()
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  async function fetchTables() {
    try {
      const res = await fetch("/api/tables", { cache: "no-store" })
      const data = await parseArrayResponse<Table>(res)
      setTables(data)
    } catch {
      // keep existing values on transient failures
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch("/api/tags", { cache: "no-store" })
      const data = await parseArrayResponse<Tag>(res)
      setTags(data)
    } catch {
      // keep existing values on transient failures
    }
  }

  useEffect(() => {
    fetchTables()
    fetchTags()
    const interval = setInterval(() => {
      fetchTables()
      fetchTags()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  async function lockTable(tableId: string, lock: boolean) {
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: lock ? "LOCK_TABLE" : "UNLOCK_TABLE",
        tableId,
      }),
    })
    fetchTables()
  }

  async function closeTable(tableId: string, paid: boolean) {
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: paid ? "CLOSE_PAID" : "CLOSE_UNPAID",
        tableId,
      }),
    })
    setActiveTable(null)
    fetchTables()
  }

  if (activeTable) {
    const assignedTags = tags.filter(
      t => t.tableNumber === activeTable.number
    )

    return (
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold">
              Table {activeTable.number}
            </div>
            <div className="flex gap-2">
              {activeTable.locked && <Badge>locked</Badge>}
              {activeTable.stale && <Badge>stale</Badge>}
              {!activeTable.paid && activeTable.closed && (
                <Badge>unpaid</Badge>
              )}
            </div>
          </div>
        </Card>

        <TableAssignment
          tableId={activeTable.id}
          tableNumber={activeTable.number}
          tags={assignedTags}
          allTags={tags}
          onChange={fetchTags}
        />

        <Divider />

        <div className="grid grid-cols-2 gap-2">
          <Card
            className="cursor-pointer text-center"
            onClick={() => lockTable(activeTable.id, !activeTable.locked)}
          >
            {activeTable.locked ? "Unlock table" : "Lock table"}
          </Card>

          <Card
            className="cursor-pointer text-center"
            onClick={() => closeTable(activeTable.id, true)}
          >
            Close as paid
          </Card>

          <Card
            className="cursor-pointer text-center"
            onClick={() => closeTable(activeTable.id, false)}
          >
            Close as unpaid
          </Card>
        </div>

        <Card
          className="cursor-pointer text-center opacity-70"
          onClick={() => setActiveTable(null)}
        >
          Back to tables
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {tables.map(table => (
        <Card
          key={table.id}
          onClick={() => setActiveTable(table)}
          className="cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                Table {table.number}
              </div>
              <div className="text-sm opacity-70">
                Open {minutesSince(table.openedAt)}m ago
              </div>
            </div>

            <div className="flex gap-2 items-center">
              {table.locked && <Badge>locked</Badge>}
              {table.stale && <Badge>stale</Badge>}
              {!table.paid && table.closed && (
                <Badge>unpaid</Badge>
              )}
            </div>
          </div>
        </Card>
      ))}

      {tables.length === 0 && (
        <div className="opacity-60 text-center">
          No tables
        </div>
      )}
    </div>
  )
}
