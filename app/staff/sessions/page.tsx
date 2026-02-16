"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Divider } from "@/components/ui/Divider"
import { StaffOrderEditor } from "@/components/staff/StaffOrderEditor"

type Session = {
  id: string
  origin: "CUSTOMER" | "STAFF"
  tagId: string | null
  tableId: string | null
  lastActivityAt: string
  stale: boolean
}

export default function StaffSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)

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

  async function parseObjectResponse<T>(
    res: Response
  ): Promise<T | null> {
    const raw = await res.text()
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as unknown
      return parsed as T
    } catch {
      return null
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch("/api/sessions", {
        cache: "no-store",
      })
      const data = await parseArrayResponse<Session>(res)
      setSessions(data)
    } catch {
      // keep current state on transient network failures
    }
  }

  useEffect(() => {
    fetchSessions()
    // Sessions are active; poll every 8 seconds for active customer sessions
    const interval = setInterval(fetchSessions, 8000)
    return () => clearInterval(interval)
  }, [])

  async function createStaffSession() {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "STAFF",
        }),
      })

      const session = await parseObjectResponse<Session>(res)
      if (!session || typeof session.id !== "string") return

      setActiveSession(session)
      fetchSessions()
    } catch {
      // no-op; caller can retry
    }
  }

  function minutesSince(ts: string) {
    return Math.floor(
      (Date.now() - new Date(ts).getTime()) / 60000
    )
  }

  if (activeSession) {
    return (
      <StaffOrderEditor
        sessionId={activeSession.id}
        onBack={() => {
          setActiveSession(null)
          fetchSessions()
        }}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      <Card
        className="cursor-pointer text-center"
        onClick={createStaffSession}
      >
        + Create staff session
      </Card>

      <Divider />

      {sessions.map(session => (
        <Card
          key={session.id}
          onClick={() => setActiveSession(session)}
          className="cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="text-sm font-mono">
                {session.id}
              </div>

              <div className="text-sm opacity-70">
                {session.origin === "STAFF"
                  ? "Staff-created session"
                  : "Customer session"}
              </div>

              <div className="text-xs opacity-60">
                Tag: {session.tagId ?? "—"} · Table:{" "}
                {session.tableId ?? "—"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {session.stale && <Badge>stale</Badge>}
              <Badge>
                {minutesSince(session.lastActivityAt)}m
              </Badge>
            </div>
          </div>
        </Card>
      ))}

      {sessions.length === 0 && (
        <div className="opacity-60 text-center space-y-1">
          <div>No active sessions</div>
          <div className="text-xs">
            Opening <code>/order/menu</code> does not create a table session. Sessions
            appear when guests open a tag URL like{" "}
            <code>/order/t/&lt;tagId&gt;</code>
            .
          </div>
        </div>
      )}
    </div>
  )
}
