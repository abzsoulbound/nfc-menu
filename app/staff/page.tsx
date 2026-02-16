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

  async function fetchAll() {
    try {
      const [tagsRes, tablesRes, sessionsRes] = await Promise.all([
        fetch("/api/tags", { cache: "no-store" }),
        fetch("/api/tables", { cache: "no-store" }),
        fetch("/api/sessions", { cache: "no-store" }),
      ])

      const [nextTags, nextTables, nextSessions] = await Promise.all([
        parseArrayResponse<Tag>(tagsRes),
        parseArrayResponse<Table>(tablesRes),
        parseArrayResponse<Session>(sessionsRes),
      ])

      setTags(nextTags)
      setTables(nextTables)
      setSessions(nextSessions)
    } catch {
      // keep existing values on transient fetch/parsing failures
    }
  }

  useEffect(() => {
    fetchAll()
    // Poll all staff data every 10 seconds (overview data changes less frequently)
    const interval = setInterval(fetchAll, 10000)
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

      {sessions.length === 0 && (
        <Card className="text-sm opacity-70">
          No active sessions yet. Opening <code>/order/menu</code> does not create a
          table session. Sessions appear when guests open a tag URL like{" "}
          <code>
            /order/t/&lt;tagId&gt;
          </code>
          .
        </Card>
      )}

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
