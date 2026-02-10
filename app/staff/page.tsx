"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"

type Tag = {
  id: string
  tableNumber: number | null
  activeSessionCount: number
  lastSeenAt: string
}

type Table = {
  id: string
  number: number
  locked: boolean
  stale: boolean
  closed: boolean
}

type Session = {
  id: string
  origin: "CUSTOMER" | "STAFF"
  tagId: string | null
  tableId: string | null
  lastActivityAt: string
}

export default function StaffDashboard() {
  const [tags, setTags] = useState<Tag[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [sessions, setSessions] = useState<Session[]>([])

  async function fetchAll() {
    const [tagsRes, tablesRes, sessionsRes] = await Promise.all([
      fetch("/api/tags", { cache: "no-store" }),
      fetch("/api/tables", { cache: "no-store" }),
      fetch("/api/sessions", { cache: "no-store" }),
    ])

    setTags(await tagsRes.json())
    setTables(await tablesRes.json())
    setSessions(await sessionsRes.json())
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [])

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  const unassignedTags = tags.filter(t => t.tableNumber === null)
  const activeTables = tables.filter(t => !t.closed)

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Link href="/staff/tables">
          <Card className="cursor-pointer">
            <div className="text-lg font-semibold">Tables</div>
            <div className="text-sm opacity-70">
              {activeTables.length} active
            </div>
          </Card>
        </Link>

        <Link href="/staff/tags">
          <Card className="cursor-pointer">
            <div className="text-lg font-semibold">NFC Tags</div>
            <div className="text-sm opacity-70">
              {tags.length} detected
            </div>
          </Card>
        </Link>

        <Link href="/staff/sessions">
          <Card className="cursor-pointer">
            <div className="text-lg font-semibold">Sessions</div>
            <div className="text-sm opacity-70">
              {sessions.length} active
            </div>
          </Card>
        </Link>
      </div>

      <Divider />

      <div className="space-y-3">
        <div className="text-sm font-semibold opacity-70">
          Unassigned NFC tags
        </div>

        {unassignedTags.map(tag => (
          <Card key={tag.id}>
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <div className="font-mono text-sm">
                  {tag.id}
                </div>
                <div className="text-xs opacity-60">
                  {tag.activeSessionCount} session(s)
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge>
                  {minutesSince(tag.lastSeenAt)}m
                </Badge>
              </div>
            </div>
          </Card>
        ))}

        {unassignedTags.length === 0 && (
          <div className="opacity-60 text-center">
            No unassigned tags
          </div>
        )}
      </div>
    </div>
  )
}
